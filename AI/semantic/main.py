import re
from common import cfg, now_ts
from kafka_io import make_consumer, make_producer, read_json, send_json

EDU_RULES = {
    "Definition": ["define", "definition", "means", "is called"],
    "ExamPoint": ["important", "exam", "mark", "note this"],
    "Deadline": ["deadline", "submit", "due", "last date"],
    "Assignment": ["assignment", "homework", "task"],
    "Concept": ["concept", "topic", "chapter", "module"],
}

def tag_transcript(transcript: str):
    tags = []
    
    # Strip non-alphanumeric chars for clean matching
    clean_text = re.sub(r'[^\w\s]', '', transcript).lower()
    words = clean_text.split()

    for tag_type, keywords in EDU_RULES.items():
        for kw in keywords:
            if kw in clean_text:
                tags.append({"type": tag_type, "value": kw})

    # simple topic extraction (capital words)
    topics = list({t for t in re.findall(r"\b[A-Z][a-zA-Z]{3,}\b", transcript)})[:15]
    
    # fallback topics
    if not topics and len(words) > 10:
        sorted_words = sorted([w for w in set(words) if len(w) > 4], key=len, reverse=True)
        topics = [w.capitalize() for w in sorted_words[:8]]

    return {"topics": topics, "tags": tags[:20]}

def run():
    c = make_consumer(cfg.KAFKA_BOOTSTRAP, cfg.GROUP_SEM)
    c.subscribe([cfg.TOPIC_SEM_REQ])
    p = make_producer(cfg.KAFKA_BOOTSTRAP)
    print(f"[semantic] listening: {cfg.TOPIC_SEM_REQ}")

    while True:
        msg = c.poll(1.0)
        if msg is None:
            continue
        if msg.error():
            print("[semantic] kafka error:", msg.error())
            continue

        req = read_json(msg)
        meeting_id = req.get("meeting_id")
        transcript = req.get("transcript")

        if not meeting_id or transcript is None:
            c.commit(msg)
            continue
            
        if not transcript:
            transcript = "No spoken audio was detected during this session."

        result = tag_transcript(transcript)
        out = {"meeting_id": meeting_id, **result, "created_at": now_ts()}
        send_json(p, cfg.TOPIC_SEM_RES, out, key=meeting_id)
        c.commit(msg)

if __name__ == "__main__":
    run()