from common import cfg, now_ts
from kafka_io import make_consumer, make_producer, read_json, send_json

# Minimal in-memory aggregation (MVP).
# Later you can store in DB via Rust backend; for now AI emits "full transcript updated".

TRANSCRIPTS = {}  # meeting_id -> list of {start_time,end_time,text}

def run():
    c = make_consumer(cfg.KAFKA_BOOTSTRAP, cfg.GROUP_TRANSCRIPT)
    c.subscribe([cfg.TOPIC_TXT_CHUNK])
    p = make_producer(cfg.KAFKA_BOOTSTRAP)

    print(f"[transcript] listening: {cfg.TOPIC_TXT_CHUNK}")

    while True:
        msg = c.poll(1.0)
        if msg is None:
            continue
        if msg.error():
            print("[transcript] kafka error:", msg.error())
            continue

        chunk = read_json(msg)
        meeting_id = chunk.get("meeting_id")
        if not meeting_id:
            c.commit(msg)
            continue

        TRANSCRIPTS.setdefault(meeting_id, []).append({
            "start_time": chunk.get("start_time") or 0,
            "end_time": chunk.get("end_time") or 0,
            "text": chunk.get("text") or "",
        })

        # sort by time
        TRANSCRIPTS[meeting_id].sort(key=lambda x: x["start_time"])

        full_text = " ".join([x["text"] for x in TRANSCRIPTS[meeting_id] if x["text"]]).strip()

        out = {
            "meeting_id": meeting_id,
            "transcript": full_text,
            "updated_at": now_ts(),
        }
        send_json(p, cfg.TOPIC_TXT_FULL, out, key=meeting_id)

        # OPTIONAL: trigger summary/mom/semantic requests when transcript updates
        # (or only at meeting end event later from backend)
        c.commit(msg)

if __name__ == "__main__":
    run()