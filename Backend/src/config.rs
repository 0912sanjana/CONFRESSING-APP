use std::env;

#[derive(Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub kafka_brokers: String,
    pub kafka_topic_meeting_events: String,
    pub livekit_api_key: String,
    pub livekit_api_secret: String,
    pub livekit_ws_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = env::var("PORT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(8000);

        Self {
            host,
            port,
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL missing"),
            kafka_brokers: env::var("KAFKA_BROKERS").unwrap_or_else(|_| "127.0.0.1:9092".to_string()),
            kafka_topic_meeting_events: env::var("KAFKA_TOPIC_MEETING_EVENTS")
                .unwrap_or_else(|_| "meeting.events".to_string()),
            livekit_api_key: env::var("LIVEKIT_API_KEY").expect("LIVEKIT_API_KEY missing"),
            livekit_api_secret: env::var("LIVEKIT_API_SECRET").expect("LIVEKIT_API_SECRET missing"),
            livekit_ws_url: env::var("LIVEKIT_WS_URL").unwrap_or_else(|_| "wss://localhost".to_string()),
        }
    }
}