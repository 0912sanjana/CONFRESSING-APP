from common import cfg, now_ts
from kafka_io import make_consumer, make_producer, read_json, send_json
from storage import download_to_tmp
from whisper_engine import WhisperSTT

def run():
    c = make_consumer(cfg.KAFKA_BOOTSTRAP, cfg.GROUP_STT)
    c.subscribe([cfg.TOPIC_AUDIO])
    p = make_producer(cfg.KAFKA_BOOTSTRAP)

    stt = WhisperSTT(cfg.WHISPER_MODEL, cfg.WHISPER_DEVICE, cfg.WHISPER_COMPUTE)
    print(f"[stt] listening: {cfg.TOPIC_AUDIO}")

    while True:
        msg = c.poll(1.0)
        if msg is None:
            continue
        if msg.error():
            print("[stt] kafka error:", msg.error())
            continue

        data = read_json(msg)
        meeting_id = data.get("meeting_id")
        chunk_url = data.get("chunk_url")

        if not meeting_id or not chunk_url:
            print("[stt] invalid payload:", data)
            c.commit(msg)
            continue

        local = download_to_tmp(
            chunk_url,
            cfg.S3_ENDPOINT, cfg.S3_ACCESS_KEY, cfg.S3_SECRET_KEY, cfg.S3_REGION
        )
        text = stt.transcribe(local)

        out = {
            "meeting_id": meeting_id,
            "text": text,
            "start_time": data.get("start_time"),
            "end_time": data.get("end_time"),
            "source_chunk_url": chunk_url,
            "created_at": now_ts(),
        }
        send_json(p, cfg.TOPIC_TXT_CHUNK, out, key=meeting_id)
        c.commit(msg)

if __name__ == "__main__":
    run()