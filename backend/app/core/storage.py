import os
import logging
import boto3
from botocore.client import Config
from app.config import settings
import uuid

logger = logging.getLogger("compliance.storage")

LOCAL_STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploaded_files")
os.makedirs(LOCAL_STORAGE_DIR, exist_ok=True)

s3_client = boto3.client(
    "s3",
    endpoint_url=settings.minio_endpoint,
    aws_access_key_id=settings.minio_access_key,
    aws_secret_access_key=settings.minio_secret_key,
    config=Config(s3={'addressing_style': 'path'}, connect_timeout=3, retries={'max_attempts': 1}),
    region_name="us-east-1"
)

def upload_file_to_minio(file_bytes: bytearray, original_filename: str, content_type: str) -> str:
    file_extension = original_filename.split(".")[-1] if "." in original_filename else "bin"
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    
    try:
        try:
            s3_client.head_bucket(Bucket=settings.minio_bucket_name)
        except Exception:
            s3_client.create_bucket(Bucket=settings.minio_bucket_name)

        s3_client.put_object(
            Bucket=settings.minio_bucket_name,
            Key=unique_filename,
            Body=bytes(file_bytes),
            ContentType=content_type
        )
        return unique_filename
    except Exception as exc:
        logger.warning(
            "MinIO storage connection failed or unavailable (%s). Falling back to local storage.",
            exc,
        )
        local_path = os.path.join(LOCAL_STORAGE_DIR, unique_filename)
        with open(local_path, "wb") as f:
            f.write(bytes(file_bytes))
        return f"local://{unique_filename}"
    