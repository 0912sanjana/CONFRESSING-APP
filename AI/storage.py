import os, tempfile
from urllib.parse import urlparse
import boto3

def parse_obj_url(url: str) -> tuple[str, str]:
    # supports s3://bucket/key or minio://bucket/key
    p = urlparse(url)
    if p.scheme not in ("s3", "minio"):
        raise ValueError(f"Unsupported scheme: {p.scheme}")
    return p.netloc, p.path.lstrip("/")

def download_to_tmp(url: str, endpoint: str, access: str, secret: str, region: str) -> str:
    bucket, key = parse_obj_url(url)
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access,
        aws_secret_access_key=secret,
        region_name=region,
    )
    tmp_dir = tempfile.mkdtemp(prefix="ai_audio_")
    local = os.path.join(tmp_dir, os.path.basename(key))
    s3.download_file(bucket, key, local)
    return local