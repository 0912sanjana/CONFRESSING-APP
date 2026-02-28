use rdkafka::consumer::{Consumer, StreamConsumer, CommitMode};
use rdkafka::{ClientConfig, Message};
use sqlx::PgPool;
use uuid::Uuid;
pub async fn start_ai_result_listener(brokers: &str, db: PgPool) {
    let consumer: StreamConsumer = ClientConfig::new()
        .set("bootstrap.servers", brokers)
        .set("group.id", "backend-ai-listener")
        .set("enable.auto.commit", "false")
        .set("auto.offset.reset", "earliest")
        .create()
        .expect("Consumer creation failed");

    consumer
        .subscribe(&["ai.summary.result", "ai.mom.result", "ai.semantic.result", "ai.transcript.chunk"])
        .expect("Can't subscribe to specified topics");

    tracing::info!("Started background AI result Kafka listener");

    while let Ok(msg) = consumer.recv().await {
        if let Some(payload) = msg.payload() {
            let topic = msg.topic();
            if let Ok(data) = serde_json::from_slice::<serde_json::Value>(payload) {
                let meeting_id = match data.get("meeting_id").and_then(|v| v.as_str()) {
                    Some(id) => match Uuid::parse_str(id) {
                        Ok(u) => u,
                        Err(_) => continue,
                    },
                    None => continue,
                };

                match topic {
                    "ai.summary.result" => {
                        if let Some(summary) = data.get("summary").and_then(|v| v.as_str()) {
                            let _ = sqlx::query(
                                r#"
                                INSERT INTO summaries (meeting_id, content) 
                                VALUES ($1, $2)
                                ON CONFLICT (meeting_id) DO UPDATE SET content = $2
                                "#
                            )
                            .bind(meeting_id)
                            .bind(summary)
                            .execute(&db)
                            .await;
                        }
                    }
                    "ai.mom.result" => {
                        let decisions = data.get("decisions")
                            .and_then(|v| v.as_array())
                            .map(|arr| arr.iter().filter_map(|i| i.as_str().map(String::from)).collect::<Vec<_>>());
                        
                        let actions = data.get("action_items")
                            .and_then(|v| v.as_array())
                            .map(|arr| arr.iter().filter_map(|i| {
                                i.get("task").and_then(|t| t.as_str()).map(String::from)
                            }).collect::<Vec<_>>());

                        if decisions.is_some() || actions.is_some() {
                            let _ = sqlx::query(
                                r#"
                                INSERT INTO mom_documents (meeting_id, key_points, action_items) 
                                VALUES ($1, $2, $3)
                                ON CONFLICT (meeting_id) DO UPDATE 
                                SET key_points = $2, action_items = $3
                                "#
                            )
                            .bind(meeting_id)
                            .bind(decisions)
                            .bind(actions)
                            .execute(&db)
                            .await;
                        }
                    }
                    "ai.semantic.result" => {
                        // Extract basic topics and insert them 
                        // (topics array has just strings, but DB has time_spent_seconds, 
                        //  we default to 0 for MVP)
                        if let Some(topics) = data.get("topics").and_then(|v| v.as_array()) {
                            for topic_val in topics {
                                if let Some(topic_str) = topic_val.as_str() {
                                    let _ = sqlx::query(
                                        r#"
                                        INSERT INTO topic_coverage (meeting_id, topic_name, time_spent_seconds)
                                        VALUES ($1, $2, $3)
                                        "#
                                    )
                                    .bind(meeting_id)
                                    .bind(topic_str)
                                    .bind(0)
                                    .execute(&db)
                                    .await;
                                }
                            }
                        }
                    }
                    "ai.transcript.chunk" => {
                        let text = data.get("text").and_then(|v| v.as_str()).unwrap_or("");
                        let start_time = data.get("start_time").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                        let end_time = data.get("end_time").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
                        // Use provided speaker or a default generic label
                        let speaker = data.get("speaker_id").and_then(|v| v.as_str()).unwrap_or("Speaker");
                        
                        let id = Uuid::new_v4();
                        let _ = sqlx::query(
                            r#"
                            INSERT INTO transcripts (id, meeting_id, speaker_id, text, start_time_offset, end_time_offset) 
                            VALUES ($1, $2, $3, $4, $5, $6)
                            "#
                        )
                        .bind(id)
                        .bind(meeting_id)
                        .bind(speaker)
                        .bind(text)
                        .bind(start_time)
                        .bind(end_time)
                        .execute(&db)
                        .await;
                    }
                    _ => {}
                }
            }
        }
        let _ = consumer.commit_message(&msg, CommitMode::Async);
    }
}
