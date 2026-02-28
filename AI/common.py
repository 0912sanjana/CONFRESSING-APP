import os
from dotenv import load_dotenv
load_dotenv()

class Cfg:
    KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "127.0.0.1:9092")

    # topics
    TOPIC_AUDIO = os.getenv("KAFKA_TOPIC_AUDIO", "media.audio.chunks")
    TOPIC_TXT_CHUNK = os.getenv("KAFKA_TOPIC_TXT_CHUNK", "ai.transcript.chunk")
    TOPIC_TXT_FULL = os.getenv("KAFKA_TOPIC_TXT_FULL", "meeting.transcript.updated")

    TOPIC_SUMMARY_REQ = os.getenv("KAFKA_TOPIC_SUMMARY_REQ", "ai.summary.request")
    TOPIC_SUMMARY_RES = os.getenv("KAFKA_TOPIC_SUMMARY_RES", "ai.summary.result")

    TOPIC_MOM_REQ = os.getenv("KAFKA_TOPIC_MOM_REQ", "ai.mom.request")
    TOPIC_MOM_RES = os.getenv("KAFKA_TOPIC_MOM_RES", "ai.mom.result")

    TOPIC_SEM_REQ = os.getenv("KAFKA_TOPIC_SEM_REQ", "ai.semantic.request")
    TOPIC_SEM_RES = os.getenv("KAFKA_TOPIC_SEM_RES", "ai.semantic.result")

    GROUP_STT = os.getenv("KAFKA_GROUP_STT", "ai-stt")
    GROUP_TRANSCRIPT = os.getenv("KAFKA_GROUP_TRANSCRIPT", "ai-transcript")
    GROUP_SUMMARY = os.getenv("KAFKA_GROUP_SUMMARY", "ai-summary")
    GROUP_MOM = os.getenv("KAFKA_GROUP_MOM", "ai-mom")
    GROUP_SEM = os.getenv("KAFKA_GROUP_SEM", "ai-semantic")

    # storage (MinIO/S3)
    S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
    S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
    S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
    S3_REGION = os.getenv("S3_REGION", "us-east-1")

    # whisper
    WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
    WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
    WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

cfg = Cfg()

def now_ts() -> int:
    import time
    return int(time.time())