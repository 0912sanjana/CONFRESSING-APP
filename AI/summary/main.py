from common import cfg, now_ts
from kafka_io import make_consumer, make_producer, read_json, send_json

def simple_summary(transcript: str) -> dict:
    # Handle pure unpunctuated STT blobs
    clean_text = transcript.replace("\n", " ").strip()
    words = clean_text.split()
    
    # Grab the first ~40 words for a short executive summary
    short = " ".join(words[:40]) + ("..." if len(words) > 40 else "")
    
    return {
        "summary": short if short else "No spoken audio was detected during this session.",
        "topics": [],
        "important_points": [],
    }

def run():
    c = make_consumer(cfg.KAFKA_BOOTSTRAP, cfg.GROUP_SUMMARY)
    c.subscribe([cfg.TOPIC_SUMMARY_REQ])
    p = make_producer(cfg.KAFKA_BOOTSTRAP)
    print(f"[summary] listening: {cfg.TOPIC_SUMMARY_REQ}")

    while True:
        msg = c.poll(1.0)
        if msg is None:
            continue
        if msg.error():
            print("[summary] kafka error:", msg.error())
            continue

        req = read_json(msg)
        meeting_id = req.get("meeting_id")
        transcript = req.get("transcript")  # backend can attach transcript or service can fetch from DB later

        if not meeting_id or not transcript:
            print("[summary] invalid payload:", req)
            c.commit(msg)
            continue

        result = simple_summary(transcript)
        out = {"meeting_id": meeting_id, **result, "created_at": now_ts()}
        send_json(p, cfg.TOPIC_SUMMARY_RES, out, key=meeting_id)
        c.commit(msg)

if __name__ == "__main__":
    run()