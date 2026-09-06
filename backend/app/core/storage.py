import boto3
from botocore.client import Config
from app.config import settings
import uuid

s3_client = boto3.client(
    "s3",
    endpoint_url=settings.minio_endpoint,
    aws_access_key_id=settings.minio_access_key,
    aws_secret_access_key=settings.minio_secret_key,
    config=Config(s3={'addressing_style': 'path'}),
    region_name="us-east-1"
)

def upload_file_to_minio(file_bytes: bytearray, original_filename: str, content_type: str) -> str:
    file_extension = original_filename.split(".")[-1] if "." in original_filename else "bin"
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    
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

def get_file_url(file_reference: str, expires_in: int = 3600) -> str:
    return s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.minio_bucket_name, "Key": file_reference},
        ExpiresIn=expires_in,
    )
