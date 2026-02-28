mod config;
mod db;
mod kafka;
mod livekit;
mod models;
mod routes;
mod ai_listener;

use axum::{routing::{get, post}, Router, extract::DefaultBodyLimit};
use config::Config;
use routes::{AppState};
use tower_http::cors::{CorsLayer, Any};
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let cfg = Config::from_env();
    let db = db::connect_db(&cfg.database_url).await;
    
    tracing::info!("Running database migrations...");
    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .expect("Failed to run database migrations");

    // Start background Kafka listener for AI results
    let db_clone = db.clone();
    let brokers_clone = cfg.kafka_brokers.clone();
    tokio::spawn(async move {
        ai_listener::start_ai_result_listener(&brokers_clone, db_clone).await;
    });

    let kafka = kafka::Kafka::new(&cfg.kafka_brokers, &cfg.kafka_topic_meeting_events);

    let state = AppState { cfg: cfg.clone(), db, kafka };

    let app = Router::new()
        .route("/health", get(routes::health))
        .route("/api/users", post(routes::create_user))
        .route("/api/meetings", post(routes::create_meeting).get(routes::list_meetings))
        .route("/api/meetings/:id", get(routes::get_meeting))
        .route("/api/meetings/:id/attendance", get(routes::get_meeting_attendance))
        .route("/api/meetings/schedule", post(routes::schedule_meeting))
        .route("/api/meetings/timetable", get(routes::get_timetable))
        .route("/api/meetings/:id/join", post(routes::join_meeting))
        .route("/api/meetings/:id/start", post(routes::start_meeting))
        .route("/api/meetings/:id/end", post(routes::end_meeting))
        .route("/api/meetings/:id/token", post(routes::get_meeting_token))
        .route("/api/meetings/:id/recording/start", post(routes::recording_start))
        .route("/api/meetings/:id/recording/stop", post(routes::recording_stop))
        .route("/api/meetings/:id/recording/upload", post(routes::recording_upload))
        .route("/api/meetings/:id/recording/video", get(routes::recording_stream))
        .route("/api/meetings/:id/recording", axum::routing::delete(routes::recording_delete))
        .route("/api/meetings/:id/transcript", get(routes::get_transcript))
        .route("/api/meetings/:id/summary", get(routes::get_summary))
        .route("/api/meetings/:id/mom", get(routes::get_mom))
        .route("/api/meetings/:id/topics", get(routes::get_topics))
        .route("/api/meetings/:id/live-ai", get(routes::get_live_ai))
        .route("/api/meetings/:id/transcript", post(routes::insert_transcript))
        .route("/api/teachers/:id/contribution", get(routes::get_teacher_contribution))
        .route("/api/dashboard/:user_id", get(routes::get_dashboard))
        .layer(DefaultBodyLimit::disable())
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("{}:{}", cfg.host, cfg.port);
    tracing::info!("backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}