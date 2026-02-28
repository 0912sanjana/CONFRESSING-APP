use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::{config::Config, kafka::Kafka, livekit::generate_livekit_token, models::*};

#[derive(Clone)]
pub struct AppState {
    pub cfg: Config,
    pub db: PgPool,
    pub kafka: Kafka,
}

pub async fn health() -> Json<Health> {
    Json(Health { ok: true })
}

// --- User (minimal) ---
pub async fn create_user(
    State(st): State<AppState>,
    Json(req): Json<CreateUserReq>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, String)> {
    let id = Uuid::new_v4();

    let role = match req.role {
        Role::Teacher => "teacher",
        Role::Student => "student",
        Role::Admin => "admin",
    };

    let row = sqlx::query(
        r#"
        INSERT INTO users (id, email, name, role) VALUES ($1,$2,$3,$4)
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
        RETURNING id
        "#
    )
    .bind(id)
    .bind(&req.email)
    .bind(&req.name)
    .bind(role)
    .fetch_one(&st.db)
    .await
    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    let final_id: Uuid = row.get("id");

    Ok((StatusCode::CREATED, Json(serde_json::json!({ "id": final_id }))))
}

// --- Meetings ---
pub async fn create_meeting(
    State(st): State<AppState>,
    user: CurrentUser,
    Json(req): Json<CreateMeetingReq>,
) -> Result<(StatusCode, Json<MeetingResp>), (StatusCode, String)> {
    let id = Uuid::new_v4();
    let room_name = format!("kiit-{}", id);

    let mode = match req.mode {
        MeetingMode::Online => "online",
        MeetingMode::Offline => "offline",
        MeetingMode::Hybrid => "hybrid",
    };

    let row = sqlx::query_as::<_, MeetingResp>(
        r#"
        INSERT INTO meetings (id, title, description, mode, room_name, host_user_id, status)
        VALUES ($1,$2,$3,$4,$5,$6,'scheduled')
        RETURNING
          id, title, description, mode, room_name, host_user_id,
          status, created_at, started_at, ended_at
        "#
    )
    .bind(id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(mode)
    .bind(&room_name)
    .bind(user.id)
    .fetch_one(&st.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create meeting: {}", e);
        (StatusCode::BAD_REQUEST, e.to_string())
    })?;

    tracing::info!("Meeting created successfully. ID: {}, Room: {}, Mode: {}", row.id, row.room_name, row.mode);

    // Emit Kafka event
    st.kafka.emit_meeting_event(
        &row.id.to_string(),
        &serde_json::json!({
            "type": "meeting.created",
            "meeting_id": row.id,
            "room_name": row.room_name,
            "mode": row.mode,
            "host_user_id": row.host_user_id,
            "ts": Utc::now()
        }),
    ).await;

    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn list_meetings(
    State(st): State<AppState>,
    _user: CurrentUser,
) -> Result<Json<Vec<MeetingResp>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, MeetingResp>(
        r#"
        SELECT id, title, description, mode, room_name, host_user_id, status, created_at, started_at, ended_at
        FROM meetings
        ORDER BY created_at DESC
        LIMIT 50
        "#
    )
    .fetch_all(&st.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(rows))
}

pub async fn schedule_meeting(
    State(st): State<AppState>,
    user: CurrentUser,
    Json(req): Json<ScheduleMeetingReq>,
) -> Result<(StatusCode, Json<MeetingResp>), (StatusCode, String)> {
    let id = Uuid::new_v4();
    let room_name = format!("kiit-{}", id);
    
    let mode = match req.mode {
        MeetingMode::Online => "online",
        MeetingMode::Offline => "offline",
        MeetingMode::Hybrid => "hybrid",
    };

    let row = sqlx::query_as::<_, MeetingResp>(
        r#"
        INSERT INTO meetings (
            id, title, description, mode, room_name, host_user_id, status, 
            scheduled_start, scheduled_end, course_id, batch_id, subject_id, planned_topics
        )
        VALUES ($1,$2,$3,$4,$5,$6,'scheduled',$7,$8,$9,$10,$11,$12)
        RETURNING
          id, title, description, mode, room_name, host_user_id,
          status, created_at, started_at, ended_at
        "#
    )
    .bind(id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(mode)
    .bind(&room_name)
    .bind(user.id)
    .bind(req.scheduled_start)
    .bind(req.scheduled_end)
    .bind(&req.course_id)
    .bind(&req.batch_id)
    .bind(&req.subject_id)
    .bind(&req.planned_topics)
    .fetch_one(&st.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to schedule meeting: {}", e);
        (StatusCode::BAD_REQUEST, e.to_string())
    })?;

    tracing::info!("Meeting scheduled successfully. ID: {}, Room: {}, Mode: {}, Start: {}, End: {}", row.id, row.room_name, row.mode, req.scheduled_start, req.scheduled_end);

    st.kafka.emit_meeting_event(
        &row.id.to_string(),
        &serde_json::json!({
            "type": "meeting.scheduled",
            "meeting_id": row.id,
            "room_name": row.room_name,
            "mode": row.mode,
            "host_user_id": row.host_user_id,
            "ts": Utc::now()
        }),
    ).await;

    Ok((StatusCode::CREATED, Json(row)))
}

pub async fn get_meeting(
    State(st): State<AppState>,
    _user: CurrentUser,
    Path(meeting_id): Path<Uuid>,
) -> Result<Json<MeetingResp>, (StatusCode, String)> {
    let row = sqlx::query_as::<_, MeetingResp>(
        "SELECT id, title, description, mode, room_name, host_user_id, status, created_at, started_at, ended_at FROM meetings WHERE id = $1"
    )
    .bind(meeting_id)
    .fetch_optional(&st.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match row {
        Some(m) => Ok(Json(m)),
        None => Err((StatusCode::NOT_FOUND, "Meeting not found".into())),
    }
}

pub async fn get_meeting_attendance(
    State(st): State<AppState>,
    _user: CurrentUser,
    Path(meeting_id): Path<Uuid>,
) -> Result<Json<Vec<AttendanceResp>>, (StatusCode, String)> {
    let rows = sqlx::query_as::<_, AttendanceResp>(
        r#"
        SELECT a.user_id, u.name, u.role, a.join_time, a.leave_time, a.status, a.duration_seconds
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.meeting_id = $1
        ORDER BY a.join_time ASC
        "#
    )
    .bind(meeting_id)
    .fetch_all(&st.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(rows))
}

use axum::extract::Query;

pub async fn get_timetable(
    State(st): State<AppState>,
    _user: CurrentUser,
    Query(query): Query<TimetableQuery>,
) -> Result<Json<Vec<MeetingResp>>, (StatusCode, String)> {
    
    let mut sql = "SELECT id, title, description, mode, room_name, host_user_id, status, created_at, started_at, ended_at FROM meetings WHERE status = 'scheduled'".to_string();
    
    if query.batch_id.is_some() {
        sql.push_str(" AND batch_id = $1");
    }
    sql.push_str(" ORDER BY created_at DESC LIMIT 50");

    let mut q = sqlx::query_as::<_, MeetingResp>(&sql);
    
    if let Some(ref bid) = query.batch_id {
        q = q.bind(bid);
    }

    let rows = q.fetch_all(&st.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(rows))
}

pub async fn start_meeting(
    State(st): State<AppState>,
    _user: CurrentUser,
    Path(meeting_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {

    let updated = sqlx::query(
        r#"
        UPDATE meetings
        SET status='active', started_at=now()
        WHERE id=$1
        RETURNING room_name
        "#
    )
    .bind(meeting_id)
    .fetch_one(&st.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to start meeting {}: {}", meeting_id, e);
        (StatusCode::BAD_REQUEST, e.to_string())
    })?;

    tracing::info!("Meeting {} started successfully.", meeting_id);

    let room_name: String = updated.get("room_name");

    st.kafka.emit_meeting_event(
        &meeting_id.to_string(),
        &serde_json::json!({
            "type": "meeting.started",
            "meeting_id": meeting_id,
            "room_name": room_name,
            "ts": Utc::now()
        }),
    ).await;

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn end_meeting(
    State(st): State<AppState>,
    _user: CurrentUser,
    Path(meeting_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    
    let updated = sqlx::query(
        r#"
        UPDATE meetings
        SET status='ended', ended_at=now()
        WHERE id=$1 AND status='active'
        RETURNING room_name
        "#
    )
    .bind(meeting_id)
    .fetch_optional(&st.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if updated.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Meeting not active".into()));
    }

    // Fetch the transcript to pass to AI
    let transcript_rows = sqlx::query(
        "SELECT text FROM transcripts WHERE meeting_id = $1 ORDER BY start_time_offset ASC"
    )
    .bind(meeting_id)
    .fetch_all(&st.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let full_transcript = transcript_rows
        .iter()
        .map(|row| row.get::<String, _>("text"))
        .collect::<Vec<String>>()
        .join(" ");

    // Emit AI request events
    st.kafka.emit_to_topic(
        "ai.summary.request",
        &meeting_id.to_string(),
        &serde_json::json!({
            "meeting_id": meeting_id,
            "transcript": full_transcript
        }),
    ).await;

    st.kafka.emit_to_topic(
        "ai.mom.request",
        &meeting_id.to_string(),
        &serde_json::json!({
            "meeting_id": meeting_id,
            "transcript": full_transcript
        }),
    ).await;

    st.kafka.emit_to_topic(
        "ai.semantic.request",
        &meeting_id.to_string(),
        &serde_json::json!({
            "meeting_id": meeting_id,
            "transcript": full_transcript
        }),
    ).await;

    // Standard meeting ended event
    st.kafka.emit_meeting_event(
        &meeting_id.to_string(),
        &serde_json::json!({
            "type": "meeting.ended",
            "meeting_id": meeting_id,
            "ts": Utc::now()
        }),
    ).await;

    Ok(Json(serde_json::json!({ "ok": true })))
}

// --- Token endpoint ---
pub async fn join_meeting(
    State(st): State<AppState>,
    user: CurrentUser,
    Path(meeting_id): Path<Uuid>,
) -> Result<Json<TokenResp>, (StatusCode, String)> {
    
    let row = sqlx::query("SELECT room_name FROM meetings WHERE id=$1")
        .bind(meeting_id)
        .fetch_one(&st.db)
        .await
        .map_err(|e| (StatusCode::NOT_FOUND, format!("Meeting not found: {}", e)))?;

    let room_name: String = row.get("room_name");

    // Mark attendance (insert on conflict do update)
    sqlx::query(
        r#"
        INSERT INTO attendance (meeting_id, user_id, status) 
        VALUES ($1, $2, 'present')
        ON CONFLICT (meeting_id, user_id) DO NOTHING
        "#
    )
    .bind(meeting_id)
    .bind(user.id)
    .execute(&st.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to mark attendance: {}", e)))?;

    // Emit attendance event
    st.kafka.emit_meeting_event(
        &meeting_id.to_string(),
        &serde_json::json!({
            "type": "attendance.marked",
            "meeting_id": meeting_id,
            "user_id": user.id,
            "role": user.role,
            "ts": Utc::now()
        }),
    ).await;

    // Generate token
    let identity_str = format!("{}_{}", user.role, user.name.replace(" ", "_"));
    tracing::info!("User {} ({}) joining meeting {}. Generating token...", user.name, user.role, meeting_id);
    let token = generate_livekit_token(
        &st.cfg.livekit_api_key,
        &st.cfg.livekit_api_secret,
        &room_name,
        &identity_str,
        &user.role,
        3600,
        meeting_id,
    )
    .map_err(|e| {
        tracing::error!("Failed to generate LiveKit token: {}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    tracing::info!("Token generated successfully for {}. WS URL: {}", identity_str, st.cfg.livekit_ws_url);

    Ok(Json(TokenResp {
        token,
        livekit_ws_url: st.cfg.livekit_ws_url.clone(),
        room_name,
        meeting_id,
    }))
}

pub async fn get_meeting_token(
    State(st): State<AppState>,
    user: CurrentUser,
    Path(meeting_id): Path<Uuid>,
) -> Result<Json<TokenResp>, (StatusCode, String)> {

    let row = sqlx::query("SELECT room_name FROM meetings WHERE id=$1")
        .bind(meeting_id)
        .fetch_one(&st.db)
        .await
        .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))?;

    let room_name: String = row.get("room_name");

    let identity_str = format!("{}_{}", user.role, user.name.replace(" ", "_"));
    let token = generate_livekit_token(
        &st.cfg.livekit_api_key,
        &st.cfg.livekit_api_secret,
        &room_name,
        &identity_str,
        &user.role,
        3600,
        meeting_id,
    )
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(TokenResp {
        token,
        livekit_ws_url: st.cfg.livekit_ws_url.clone(),
        room_name,
        meeting_id,
    }))
}

// --- Recording ---
pub async fn recording_start(
    State(st): State<AppState>,
    _user: CurrentUser,
    Path(meeting_id): Path<Uuid>,
) -> Result<Json<StartRecordingResp>, (StatusCode, String)> {

    let rec_id = Uuid::new_v4();

    sqlx::query("INSERT INTO recordings (meeting_id, recording_id, status) VALUES ($1,$2,'started')")
        .bind(meeting_id)
        .bind(rec_id.to_string())
        .execute(&st.db)
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

    st.kafka.emit_meeting_event(
        &meeting_id.to_string(),
        &serde_json::json!({
            "type":"recording.started",
            "meeting_id": meeting_id,
            "recording_id": rec_id,
            "ts": Utc::now()
        }),
    ).await;

    Ok(Json(StartRecordingResp {
        recording_id: rec_id,
        status: "started".into(),
    }))
}

pub async fn recording_stop(
    State(st): State<AppState>,
    _user: CurrentUser,
    Path(meeting_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {

    st.kafka.emit_meeting_event(
        &meeting_id.to_string(),
        &serde_json::json!({
            "type":"recording.stopped",
            "meeting_id": meeting_id,
            "ts": Utc::now()
        }),
    ).await;

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn recording_upload(
    State(st): State<AppState>,
    Path(meeting_id): Path<Uuid>,
    body: axum::body::Bytes,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let _ = std::fs::create_dir_all("uploads");
    let path = format!("uploads/{}.webm", meeting_id);
    std::fs::write(&path, &body).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    sqlx::query("UPDATE recordings SET status = 'completed' WHERE meeting_id = $1")
        .bind(meeting_id)
        .execute(&st.db)
        .await
        .ok();

    Ok(Json(serde_json::json!({ "ok": true, "path": path })))
}

pub async fn recording_stream(
    Path(meeting_id): Path<Uuid>,
) -> Result<axum::response::Response, (StatusCode, String)> {
    let path = format!("uploads/{}.webm", meeting_id);
    let bytes = std::fs::read(&path).map_err(|_| (StatusCode::NOT_FOUND, "Recording not found".into()))?;
    
    let response = axum::response::Response::builder()
        .header("Content-Type", "video/webm")
        .header("Accept-Ranges", "bytes")
        .body(axum::body::Body::from(bytes))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(response)
}

pub async fn recording_delete(
    State(st): State<AppState>,
    Path(meeting_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    // Attempt to delete physical file, it's okay if it fails (might be already deleted)
    let path = format!("uploads/{}.webm", meeting_id);
    let _ = std::fs::remove_file(&path);
    
    // In database we permanently delete the recording row
    sqlx::query("DELETE FROM recordings WHERE meeting_id = $1")
        .bind(meeting_id)
        .execute(&st.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // We also delete the meeting row permanently to remove it from the frontend list
    sqlx::query("DELETE FROM meetings WHERE id = $1")
        .bind(meeting_id)
        .execute(&st.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "ok": true })))
}



pub async fn get_teacher_contribution(
    State(st): State<AppState>,
    Path(teacher_id): Path<Uuid>,
    Query(_query): Query<ContributionQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    
    // For now we ignore the range and just return the last 7 records
    // In a real app we would filter by record_date > now() - range
    let rows = sqlx::query_as::<_, TeacherContributionResp>(
        r#"
        SELECT 
            t.record_date, 
            t.attendance_avg, 
            t.regularity_score,
            m.planned_topics
         FROM teacher_contribution_daily t
         LEFT JOIN meetings m ON m.id = t.meeting_id
         WHERE t.teacher_id = $1
        ORDER BY t.record_date ASC
        LIMIT 7
        "#
    )
    .bind(teacher_id)
    .fetch_all(&st.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Map the database rows to the structure expected by Recharts in Analytics.tsx
    let mut mapped_rows: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        let subject = row.planned_topics.unwrap_or_else(|| {
            // Fallback to date ONLY if subject isn't provided, not as a mock hack
            row.record_date.format("%a").to_string()
        });

        serde_json::json!({
            "subject": subject,
            "attendance": row.attendance_avg,
            "interaction": row.regularity_score
        })
    }).collect();

    if mapped_rows.is_empty() {
        // Inject rich mock data for the project presentation
        mapped_rows = vec![
            serde_json::json!({ "subject": "Data Structures", "attendance": 92, "interaction": 85 }),
            serde_json::json!({ "subject": "Algorithms", "attendance": 88, "interaction": 90 }),
            serde_json::json!({ "subject": "OS", "attendance": 95, "interaction": 82 }),
            serde_json::json!({ "subject": "Networks", "attendance": 80, "interaction": 75 }),
            serde_json::json!({ "subject": "Databases", "attendance": 98, "interaction": 96 }),
        ];
    }

    Ok(Json(serde_json::json!(mapped_rows)))
}

#[derive(Debug, serde::Serialize)]
pub struct LiveAiResp {
    pub transcripts: Vec<serde_json::Value>,
    pub suggestions: Vec<String>,
}

pub async fn get_live_ai(
    State(st): State<AppState>,
    Path(meeting_id): Path<Uuid>,
) -> Result<Json<LiveAiResp>, (StatusCode, String)> {
    
    // Fetch latest transcripts
    let transcript_rows = sqlx::query(
        "SELECT speaker_id, text, start_time_offset FROM transcripts WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 50"
    )
    .bind(meeting_id)
    .fetch_all(&st.db)
    .await
    .unwrap_or_default();

    let transcripts = transcript_rows.iter().map(|row| {
        let speaker = row.try_get::<String, _>("speaker_id").unwrap_or_else(|_| "Unknown".into());
        let text = row.try_get::<String, _>("text").unwrap_or_default();
        let time = row.try_get::<f32, _>("start_time_offset").unwrap_or_default();
        serde_json::json!({
            "speaker": speaker,
            "text": text,
            "time": time
        })
    }).collect();

    // Fetch MOM or insights for suggestions (just the latest one or fallback)
    let mom_row = sqlx::query(
        "SELECT key_points, action_items FROM mom_documents WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 1"
    )
    .bind(meeting_id)
    .fetch_optional(&st.db)
    .await
    .unwrap_or_default();

    let mut suggestions = vec![];

    // Read live topics from semantic AI
    let topic_rows = sqlx::query("SELECT DISTINCT topic_name FROM topic_coverage WHERE meeting_id = $1 LIMIT 10")
        .bind(meeting_id)
        .fetch_all(&st.db)
        .await
        .unwrap_or_default();
    
    for row in topic_rows {
        if let Ok(t) = row.try_get::<String, _>("topic_name") {
            suggestions.push(format!("Discussing: {}", t));
        }
    }

    // Fallback or additional MOM points
    if let Some(row) = mom_row {
        if let Ok(points) = row.try_get::<serde_json::Value, _>("key_points") {
            if let Some(arr) = points.as_array() {
                for v in arr {
                    if let Some(s) = v.as_str() {
                        suggestions.push(s.to_string());
                    }
                }
            }
        }
    }

    if suggestions.is_empty() {
        suggestions.push("Waiting for discussion topics...".into());
    }

    Ok(Json(LiveAiResp {
        transcripts,
        suggestions,
    }))
}

#[derive(Debug, serde::Deserialize)]
pub struct InsertTranscriptReq {
    pub speaker: String,
    pub text: String,
}

pub async fn insert_transcript(
    State(st): State<AppState>,
    Path(meeting_id): Path<Uuid>,
    Json(req): Json<InsertTranscriptReq>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    
    // In demo, we just insert into transcripts table
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO transcripts (id, meeting_id, speaker_id, text, start_time_offset, end_time_offset) 
         VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(id)
    .bind(meeting_id)
    .bind(&req.speaker)
    .bind(&req.text)
    .bind(0.0) // Mock offset
    .bind(0.0) // Mock end offset
    .execute(&st.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Emit live semantic request so the AI agent generates Live Topics and suggestions
    st.kafka.emit_to_topic(
        "ai.semantic.request",
        &meeting_id.to_string(),
        &serde_json::json!({
            "meeting_id": meeting_id,
            "transcript": req.text,
            "ts": chrono::Utc::now()
        }),
    ).await;

    Ok(Json(serde_json::json!({ "success": true, "id": id })))
}

pub async fn get_transcript(
    State(st): State<AppState>,
    Path(meeting_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let transcript_rows = sqlx::query(
        "SELECT speaker_id, text, start_time_offset FROM transcripts WHERE meeting_id = $1 ORDER BY created_at ASC"
    )
    .bind(meeting_id)
    .fetch_all(&st.db)
    .await
    .unwrap_or_default();

    let transcripts: Vec<serde_json::Value> = transcript_rows.iter().map(|row| {
        let speaker = row.try_get::<String, _>("speaker_id").unwrap_or_else(|_| "Unknown".into());
        let text = row.try_get::<String, _>("text").unwrap_or_default();
        let time = row.try_get::<f32, _>("start_time_offset").unwrap_or_default();
        let mins = (time / 60.0).floor() as i32;
        let secs = (time % 60.0) as i32;
        let time_str = format!("{:02}:{:02}", mins, secs);

        serde_json::json!({
            "speaker": speaker,
            "text": text,
            "time": time_str
        })
    }).collect();

    let content = serde_json::to_string(&transcripts).unwrap_or_else(|_| "[]".to_string());
    Ok(Json(serde_json::json!({ "content": content })))
}

pub async fn get_summary(
    State(st): State<AppState>,
    Path(meeting_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let summary_row = sqlx::query(
        "SELECT content FROM summaries WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 1"
    )
    .bind(meeting_id)
    .fetch_optional(&st.db)
    .await
    .unwrap_or_default();

    let content = summary_row
        .and_then(|row| row.try_get::<String, _>("content").ok())
        .unwrap_or_default();

    Ok(Json(serde_json::json!({ "content": content })))
}

pub async fn get_mom(
    State(st): State<AppState>,
    Path(meeting_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let mom_row = sqlx::query(
        "SELECT key_points, action_items FROM mom_documents WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 1"
    )
    .bind(meeting_id)
    .fetch_optional(&st.db)
    .await
    .unwrap_or_default();

    if let Some(row) = mom_row {
        let key_points = row.try_get::<Vec<String>, _>("key_points").unwrap_or_default();
        let action_items = row.try_get::<Vec<String>, _>("action_items").unwrap_or_default();
        Ok(Json(serde_json::json!({ "key_points": key_points, "action_items": action_items })))
    } else {
        Ok(Json(serde_json::json!({ "key_points": Vec::<String>::new(), "action_items": Vec::<String>::new() })))
    }
}

pub async fn get_topics(
    Path(_meeting_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    Ok(Json(serde_json::json!({ "topics": [] })))
}

pub async fn get_dashboard(
    State(st): State<AppState>,
    user: CurrentUser,
) -> Result<Json<DashboardDataResp>, (StatusCode, String)> {
    let user_id = user.id;

    // 2. Mock Courses (since table doesn't exist yet)
    let courses = vec![
        CourseResp {
            id: "CS-101".to_string(),
            name: "Demo Course".to_string(),
            description: Some("Introduction to the LMS".to_string()),
            teacher_id: user_id,
            created_at: chrono::Utc::now(),
        }
    ];

    // 3. Get Upcoming Meetings simply by fetching all scheduled status
    let meetings = sqlx::query_as::<_, MeetingResp>(
        r#"
        SELECT id, title, description, mode, room_name, host_user_id, status, created_at, started_at, ended_at
        FROM meetings
        WHERE status = 'scheduled'
        ORDER BY created_at DESC
        LIMIT 50
        "#
    )
    .fetch_all(&st.db)
    .await
    .unwrap_or_default();

    // 4. Calculate actual total active students enrolled (Mocking safely)
    let total_active_students: i64 = 42; // Mocked for now

    Ok(Json(DashboardDataResp {
        courses,
        upcoming_meetings: meetings,
        recent_recordings: vec![], // mock for now
        stats: serde_json::json!({
            "active_students": total_active_students,
            "hours_recorded": 12.5, // Mocked for now
            "transcripts_ready": 8 // Mocked
        })
    }))
}