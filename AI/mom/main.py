import re
from common import cfg, now_ts
from kafka_io import make_consumer, make_producer, read_json, send_json

def simple_mom(transcript: str) -> dict:
    decisions = []
    action_items = []
    
    # Clean transcript for easier parsing
    clean_text = transcript.replace("\n", " ").strip()
    words = clean_text.split()
    
    # We will generate rolling chunks of approximately 10 words to simulate sentences for context
    chunks = [" ".join(words[i:i+15]) for i in range(0, len(words), 10)]

    decision_keywords = ["decide", "final", "agree", "will go with", "decision", "conclude", "settle", "chose"]
    action_keywords = ["submit", "deadline", "due", "assignment", "homework", "task", "make sure to", "we must", "i need to", "you need to", "project", "presentation", "report"]

    for chunk in chunks:
        lower_chunk = chunk.lower()
        
        # Check decisions
        if any(kw in lower_chunk for kw in decision_keywords):
            # Clean up the chunk to make it look like a bullet point
            clean_decision = chunk.capitalize().strip(".,;: ")
            if clean_decision not in decisions:
                decisions.append(clean_decision)
                
        # Check actions
        if any(kw in lower_chunk for kw in action_keywords):
            clean_action = chunk.capitalize().strip(".,;: ")
            # Avoid perfectly duplicate tasks
            if not any(a["task"] == clean_action for a in action_items):
                action_items.append({"owner": "Student/Self", "task": clean_action, "due_date_optional": None})

    # Fallback if no actions/decisions found but we have text
    if not decisions and len(words) > 20:
        decisions.append("Discussed general topics related to the session.")
    if not action_items and len(words) > 30:
        action_items.append({"owner": "All", "task": "Review the recorded session materials.", "due_date_optional": None})

    topics = list({w for w in re.findall(r"\b[A-Z][a-zA-Z]{3,}\b", transcript)})[:10]
    if not topics and len(words) > 10:
        # Fallback grab longest words as topics if no capitalized words
        sorted_words = sorted([w for w in set(words) if len(w) > 5], key=len, reverse=True)
        topics = [w.capitalize() for w in sorted_words[:5]]

    return {
        "summary": clean_text[:400] + ("..." if len(clean_text) > 400 else ""),
        "decisions": decisions[:10],
        "action_items": action_items[:10],
        "topics": topics,
        "important_timestamps": []
    }

def run():
    c = make_consumer(cfg.KAFKA_BOOTSTRAP, cfg.GROUP_MOM)
    c.subscribe([cfg.TOPIC_MOM_REQ])
    p = make_producer(cfg.KAFKA_BOOTSTRAP)
    print(f"[mom] listening: {cfg.TOPIC_MOM_REQ}")

    while True:
        msg = c.poll(1.0)
        if msg is None:
            continue
        if msg.error():
            print("[mom] kafka error:", msg.error())
            continue

        req = read_json(msg)
        meeting_id = req.get("meeting_id")
        transcript = req.get("transcript")

        if not meeting_id or not transcript:
            c.commit(msg)
            continue

        mom = simple_mom(transcript)
        out = {"meeting_id": meeting_id, **mom, "created_at": now_ts()}
        send_json(p, cfg.TOPIC_MOM_RES, out, key=meeting_id)
        c.commit(msg)

if __name__ == "__main__":
    run()