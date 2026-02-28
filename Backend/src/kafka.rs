use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::ClientConfig;
use serde::Serialize;
use std::time::Duration;

#[derive(Clone)]
pub struct Kafka {
    producer: FutureProducer,
    topic_meeting_events: String,
}

impl Kafka {
    pub fn new(brokers: &str, topic_meeting_events: &str) -> Self {
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", brokers)
            .set("message.timeout.ms", "5000")
            .create()
            .expect("Kafka producer create failed");
        Self {
            producer,
            topic_meeting_events: topic_meeting_events.to_string(),
        }
    }

    pub async fn emit_to_topic<T: Serialize>(
        &self,
        topic: &str,
        key: &str,
        payload: &T,
    ) {
        let json = serde_json::to_string(payload).unwrap_or_else(|_| "{}".to_string());
        let topic_str = topic.to_string();
        let key_str = key.to_string();
        let producer = self.producer.clone();

        tokio::spawn(async move {
            let _ = producer
                .send(
                    FutureRecord::to(&topic_str)
                        .key(&key_str)
                        .payload(&json),
                    Duration::from_secs(0),
                )
                .await;
        });
    }

    pub async fn emit_meeting_event<T: Serialize>(
        &self,
        key: &str,
        payload: &T,
    ) {
        let json = serde_json::to_string(payload).unwrap_or_else(|_| "{}".to_string());
        let topic = self.topic_meeting_events.clone();
        let key_str = key.to_string();
        let producer = self.producer.clone();

        tokio::spawn(async move {
            let _ = producer
                .send(
                    FutureRecord::to(&topic)
                        .key(&key_str)
                        .payload(&json),
                    Duration::from_secs(0),
                )
                .await;
        });
    }
}