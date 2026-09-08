import os
import asyncio
from datetime import datetime
import uuid
from celery import Celery
from sqlalchemy import select, delete
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.config import settings
from models import Document, AIAnalysis, Flag, AnalysisStatus, Severity, Rule, PIIMapping
from app.core.storage import s3_client
from worker.ai.gemini_assist import GeminiAssistEngine
from worker.ai.pii_masker import PIIMasker
from worker.data_eng.extractors import TextExtractor, ExtractionError

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
            import tempfile
            temp_file = os.path.join(tempfile.gettempdir(), doc.file_reference)
            s3_client.download_file(settings.minio_bucket_name, doc.file_reference, temp_file)

            try:
                # 1. Text extraction from local file buffer
                text = TextExtractor.extract(temp_file)

                # 2. Server-side PII masking (Strict Privacy Boundary)
                # Sensitive entities (names, emails, phones, SSNs, accounts) are replaced
                # with stable placeholders prior to vector search or external AI calls.
                masker = PIIMasker()
                masked_text, pii_mapping = masker.mask(text)

                # Persist mapping to PostgreSQL (pii_mappings) to satisfy the zero-PII boundary constraint.
                # Delete prior mappings for this document to ensure idempotent task retries.
                await db.execute(delete(PIIMapping).where(PIIMapping.document_id == doc_uuid))
                for placeholder, original in pii_mapping.items():
                    db.add(
                        PIIMapping(
                            document_id=doc_uuid,
                            placeholder=placeholder,
                            original_value=original,
                        )
                    )
                await db.flush()

                # 3. Semantic Rule Retrieval (RAG via pgvector)
                # Retrieves compliance rules tailored to the document content.
                # Gracefully falls back to None if local embedding inference is offline.
                rules_context = None
                try:
                    from worker.data_eng.chunking import chunk_document
                    from worker.data_eng.retrieval import retrieve_rules_for_document

                    chunks = chunk_document(masked_text)
                    retrieved_rules = await retrieve_rules_for_document(db, chunks)
                    if retrieved_rules:
                        rules_context = [
                            {"id": r.rule_key, "category": r.rule_type, "text": r.text}
                            for r in retrieved_rules
                        ]
                except Exception as retrieval_err:
                    print(f"[WARN] Vector rule retrieval bypassed or unavailable: {retrieval_err}")
                    rules_context = None

                # 4. Outbound LLM Generation
                # Dispatches only sanitized text and retrieved rules to external AI providers.
                ai_engine = GeminiAssistEngine()
                analysis = ai_engine.analyze_document(masked_text, rules_context=rules_context)

                # 5. Entity Unmasking for Authorized Officer Display
                # Re-inject original values into the summary and flag excerpts before persistence.
                unmasked_summary = masker.unmask(analysis.get("summary", ""), pii_mapping)
                analysis["summary"] = unmasked_summary

                unmasked_flags = []
                for flag in analysis.get("flags", []):
                    unmasked_flags.append({
                        "passage": masker.unmask(flag.get("passage", ""), pii_mapping),
                        "matched_rule_id": flag.get("matched_rule_id"),
                        "severity": flag.get("severity", "medium"),
                        "explanation": masker.unmask(flag.get("explanation", ""), pii_mapping),
                    })
                analysis["flags"] = unmasked_flags

                # Maintain legacy document column for backward compatibility
                doc.ai_analysis = analysis

                # Process and persist flags
                raw_flags = unmasked_flags
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

            except ExtractionError as e:
                print(f"Extraction error for document {document_id}: {e}")
                err_msg = (
                    "This file format or document structure is not supported for automated AI analysis "
                    "(e.g., scanned/image-only PDF or empty file). Please proceed with manual revision."
                )
                if ai_record:
                    ai_record.status = AnalysisStatus.error
                    ai_record.summary = err_msg
                doc.ai_analysis = {
                    "summary": err_msg,
                    "flags": [],
                    "error_type": "unsupported_for_ai",
                    "error_detail": str(e),
                }
                await db.commit()
                return {"document_id": document_id, "status": "error", "error_type": "unsupported_for_ai", "error": str(e)}
            except Exception as e:
                print(f"Error processing document: {e}")
                err_msg = "AI analysis is currently unavailable for this submission. Please proceed with manual revision."
                if ai_record:
                    ai_record.status = AnalysisStatus.error
                    ai_record.summary = err_msg
                doc.ai_analysis = {
                    "summary": err_msg,
                    "flags": [],
                    "error_type": "ai_unavailable",
                    "error_detail": str(e),
                }
                await db.commit()
                return {"document_id": document_id, "status": "error", "error_type": "ai_unavailable", "error": str(e)}
            finally:
                # Cleanup the temp file
                if os.path.exists(temp_file):
                    os.remove(temp_file)

            return {"document_id": document_id, "status": "completed"}
            
    return asyncio.run(process())