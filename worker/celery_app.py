import os
import asyncio
from celery import Celery
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.config import settings
from models import Document
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
            # Fetch document from the DB
            result = await db.execute(select(Document).where(Document.id == document_id))
            doc = result.scalar_one_or_none()
            if not doc:
                return {"status": "error", "message": "Document not found"}

            #  Download the file from MinIO storage
            temp_file = f"/tmp/{doc.file_reference}"
            s3_client.download_file(settings.minio_bucket_name, doc.file_reference, temp_file)

            try:
                #  Extract text from the file
                text = TextExtractor.extract(temp_file)
                
                #  Run AI Analysis 
    
                ai_engine = GeminiAssistEngine()
                analysis = ai_engine.analyze_document(text) 
                
                #  Save AI's JSON response to the database column
                doc.ai_analysis = analysis
                await db.commit()
            except Exception as e:
                print(f"Error processing document: {e}")
            finally:
                # Cleanup the temp file
                if os.path.exists(temp_file):
                    os.remove(temp_file)

            return {"document_id": document_id, "status": "completed"}
            
    
    return asyncio.run(process())