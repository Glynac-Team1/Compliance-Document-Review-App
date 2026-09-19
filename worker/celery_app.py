import asyncio
import os
import uuid
from datetime import datetime

from celery import Celery
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.core.storage import s3_client
from models import (
    AIAnalysis,
    AnalysisStatus,
    Document,
    Flag,
    PIIMapping,
    Rule,
    Severity,
)
from worker.ai.gemini_assist import GeminiAssistEngine
from worker.ai.pii_masker import PIIMasker
from worker.data_eng.disclosure_check import find_missing_disclosures
from worker.data_eng.extractors import ExtractionError, TextExtractor
from worker.data_eng.precedent_search import retrieve_precedents

celery_app = Celery("compliance_review", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_default_queue = "document-analysis"

@celery_app.task
def analyze_document(document_id: str) -> dict:
    async def process():
        engine = create_async_engine(settings.database_url)
        SessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
        try:
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

                    # 3. Compute one local embedding batch and reuse it for every retrieval job.
                    # The same masked vectors drive rules, missing disclosures, and precedents.
                    rules_context = []
                    missing_disclosures = []
                    precedents = []
                    try:
                        from worker.data_eng.chunking import chunk_document
                        from worker.data_eng.embeddings import embed_document_chunks
                        from worker.data_eng.retrieval import (
                            retrieve_rules_for_document,
                        )

                        chunks = embed_document_chunks(chunk_document(masked_text))
                        chunk_embeddings = [chunk.embedding for chunk in chunks if chunk.embedding is not None]
                        retrieved_rules = await retrieve_rules_for_document(db, chunk_embeddings)
                        missing = await find_missing_disclosures(db, chunk_embeddings)
                        retrieved_precedents = await retrieve_precedents(db, chunk_embeddings)

                        rules_context = [
                            {"id": rule.rule_key, "category": rule.rule_type, "text": rule.text}
                            for rule in retrieved_rules
                        ]
                        missing_disclosures = [
                            {
                                "id": item.rule_key,
                                "text": item.text,
                                "closest_distance": item.closest_distance,
                            }
                            for item in missing
                        ]
                        precedents = [
                            {
                                "decision": item.decision,
                                # Precedent comments are database text and may contain
                                # client details from a real review; mask before Gemini.
                                "comment": masker.mask(item.comment)[0],
                                "distance": item.distance,
                            }
                            for item in retrieved_precedents
                        ]
                    except Exception as retrieval_err:
                        print(f"[WARN] Vector retrieval bypassed or unavailable: {retrieval_err}")

                    # 4. Outbound LLM Generation
                    # Dispatches only sanitized text and retrieved rules to external AI providers.
                    ai_engine = GeminiAssistEngine()
                    analysis = ai_engine.analyze_masked_document(
                        masked_text,
                        pii_mapping,
                        rules_context,
                        missing_disclosures,
                        precedents,
                    )

                    analysis["precedents"] = precedents

                    # Only persist flags grounded in the rules supplied to the model.
                    allowed_rule_ids = {
                        item["id"] for item in rules_context
                    } | {
                        item["id"] for item in missing_disclosures
                    }
                    analysis["flags"] = [
                        flag for flag in analysis.get("flags", [])
                        if flag.get("matched_rule_id") in allowed_rule_ids
                    ]

                    # 5. GeminiAssistEngine validates and unmaskes only after a valid response.
                    # Maintain the legacy document column for backward compatibility.
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

                    # A degraded result is useful for the JSON audit trail, but it is not
                    # a successful automated analysis and requires manual review.
                    ai_record.summary = analysis.get("summary")
                    ai_record.model_name = analysis.get("model")
                    ai_record.error_message = (
                        analysis.get("summary") if analysis.get("degraded") else None
                    )
                    ai_record.status = AnalysisStatus.error if analysis.get("degraded") else AnalysisStatus.ready
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

        finally:
            await engine.dispose()
    return asyncio.run(process())