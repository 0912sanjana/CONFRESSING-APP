import json
from confluent_kafka import Consumer, Producer

def make_consumer(bootstrap: str, group_id: str) -> Consumer:
    return Consumer({
        "bootstrap.servers": bootstrap,
        "group.id": group_id,
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,
    })

def make_producer(bootstrap: str) -> Producer:
    return Producer({"bootstrap.servers": bootstrap})

def read_json(msg) -> dict:
    return json.loads(msg.value().decode("utf-8"))

def send_json(producer: Producer, topic: str, payload: dict, key: str | None = None):
    producer.produce(
        topic=topic,
        key=key.encode("utf-8") if key else None,
        value=json.dumps(payload).encode("utf-8"),
    )
    producer.flush()