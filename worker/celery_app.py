import os
import asyncio
from datetime import datetime
import uuid
from celery import Celery
from sqlalchemy import select, delete
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.config import settings
from models import Document, AIAnalysis, Flag, AnalysisStatus, Severity, Rule
from app.core.storage import s3_client
from worker.ai.gemini_assist import GeminiAssistEngine
from worker.data_eng.extractors import TextExtractor

celery_app = Celery("compliance_review", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_default_queue = "document-analysis"

@celery_app.task
def analyze_document(document_id: str) -> dict:
    async def process():
        engine = create_async_engine(settings.database_url)
        SessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
        
        async with SessionLocal() as db:
            # Parse document_id UUID safely
            doc_uuid = uuid.UUID(document_id) if isinstance(document_id, str) else document_id

            # Fetch document from the DB
            result = await db.execute(select(Document).where(Document.id == doc_uuid))
            doc = result.scalar_one_or_none()
            if not doc:
                return {"status": "error", "message": "Document not found"}

            # Fetch or create the associated AIAnalysis record
            ai_res = await db.execute(select(AIAnalysis).where(AIAnalysis.document_id == doc_uuid))
            ai_record = ai_res.scalar_one_or_none()
            if not ai_record:
                ai_record = AIAnalysis(document_id=doc_uuid, status=AnalysisStatus.pending)
                db.add(ai_record)
                await db.commit()
                await db.refresh(ai_record)

            # Download the file from MinIO storage
            temp_file = f"/tmp/{doc.file_reference}"
            s3_client.download_file(settings.minio_bucket_name, doc.file_reference, temp_file)

            try:
                # Extract text from the file
                text = TextExtractor.extract(temp_file)
                
                # Run AI Analysis
                ai_engine = GeminiAssistEngine()
                analysis = ai_engine.analyze_document(text)
                
                # Maintain legacy document column for backward compatibility
                doc.ai_analysis = analysis

                # Process and persist flags
                raw_flags = analysis.get("flags", [])
                rule_keys = [f.get("matched_rule_id") for f in raw_flags if f.get("matched_rule_id")]

                rules_by_key = {}
                if rule_keys:
                    rules_res = await db.execute(select(Rule).where(Rule.rule_key.in_(rule_keys)))
                    for r in rules_res.scalars().all():
                        rules_by_key[r.rule_key] = r.id

                # Remove prior flags for this analysis if any exist
                await db.execute(delete(Flag).where(Flag.analysis_id == ai_record.id))

                for flag_data in raw_flags:
                    raw_rule_id = flag_data.get("matched_rule_id")
                    rule_uuid = rules_by_key.get(raw_rule_id)

                    # Match case-insensitively if direct lookup misses
                    if not rule_uuid and raw_rule_id:
                        for k, v in rules_by_key.items():
                            if k.lower() == raw_rule_id.lower():
                                rule_uuid = v
                                break

                    # If rule not present in DB, fall back to any existing rule or create fallback stub
                    if not rule_uuid and raw_rule_id:
                        any_rule = await db.scalar(select(Rule.id))
                        if any_rule:
                            rule_uuid = any_rule
                        else:
                            fallback_rule = Rule(
                                rule_key=raw_rule_id,
                                rule_type="compliance",
                                text=f"Compliance standard: {raw_rule_id}",
                                embedding=[0.0] * 768,
                                source="auto-fallback",
                            )
                            db.add(fallback_rule)
                            await db.flush()
                            rule_uuid = fallback_rule.id
                            rules_by_key[raw_rule_id] = rule_uuid

                    if not rule_uuid:
                        continue

                    # Map severity string to enum
                    raw_sev = str(flag_data.get("severity", "medium")).lower()
                    sev_enum = Severity.medium
                    if raw_sev == "high":
                        sev_enum = Severity.high
                    elif raw_sev == "low":
                        sev_enum = Severity.low

                    db.add(
                        Flag(
                            analysis_id=ai_record.id,
                            passage_excerpt=flag_data.get("passage", ""),
                            matched_rule_id=rule_uuid,
                            explanation=flag_data.get("explanation", ""),
                            severity=sev_enum,
                        )
                    )

                # Transition analysis status to ready
                ai_record.summary = analysis.get("summary")
                ai_record.status = AnalysisStatus.ready
                ai_record.generated_at = datetime.utcnow()
                await db.commit()

            except Exception as e:
                print(f"Error processing document: {e}")
                if ai_record:
                    ai_record.status = AnalysisStatus.error
                    await db.commit()
                return {"document_id": document_id, "status": "error", "error": str(e)}
            finally:
                # Cleanup the temp file
                if os.path.exists(temp_file):
                    os.remove(temp_file)

            return {"document_id": document_id, "status": "completed"}
            
    return asyncio.run(process())