use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sqlx::FromRow;
use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};

#[derive(Debug, Clone)]
pub struct CurrentUser {
    pub id: Uuid,
    pub name: String,
    pub role: String,
}

#[async_trait]
impl<S> FromRequestParts<S> for CurrentUser
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let id_str = parts.headers.get("x-dev-user-id").and_then(|h| h.to_str().ok());
        let name = parts.headers.get("x-dev-user-name").and_then(|h| h.to_str().ok()).unwrap_or("Dev User").to_string();
        let role = parts.headers.get("x-dev-user-role").and_then(|h| h.to_str().ok()).unwrap_or("student").to_string();

        let id = match id_str {
            Some(uuid_str) => match Uuid::parse_str(uuid_str) {
                Ok(uuid) => uuid,
                Err(_) => return Err((StatusCode::UNAUTHORIZED, "Invalid x-dev-user-id header format".to_string())),
            },
            None => return Err((StatusCode::UNAUTHORIZED, "Missing x-dev-user-id header".to_string())),
        };

        Ok(CurrentUser { id, name, role })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Health {
    pub ok: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Teacher,
    Student,
    Admin,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateUserReq {
    pub email: String,
    pub name: String,
    pub role: Role,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MeetingMode {
    Online,
    Offline,
    Hybrid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateMeetingReq {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub mode: MeetingMode,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScheduleMeetingReq {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub mode: MeetingMode,
    pub scheduled_start: DateTime<Utc>,
    pub scheduled_end: DateTime<Utc>,
    #[serde(default)]
    pub course_id: Option<String>,
    #[serde(default)]
    pub batch_id: Option<String>,
    #[serde(default)]
    pub subject_id: Option<String>,
    #[serde(default)]
    pub planned_topics: Option<serde_json::Value>,
}

// JoinMeetingReq removed because `join_meeting` handler doesn't extract JSON body anymore
// TokenReq removed for same reason

// pub struct JoinMeetingReq
// pub struct TokenReq

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct MeetingResp {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub mode: String,
    pub room_name: String,
    pub host_user_id: Uuid,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct AttendanceResp {
    pub user_id: Uuid,
    pub name: String,
    pub role: String,
    pub join_time: DateTime<Utc>,
    pub leave_time: Option<DateTime<Utc>>,
    pub status: String,
    pub duration_seconds: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimetableQuery {
    pub batch_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContributionQuery {
    pub range: Option<String>, // e.g., "30d"
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TeacherContributionResp {
    pub record_date: chrono::NaiveDate,
    pub meetings_taken: Option<i32>,
    pub attendance_avg: Option<f32>,
    pub topic_coverage_count: Option<i32>,
    pub regularity_score: Option<f32>,
    pub planned_topics: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenResp {
    pub token: String,
    pub livekit_ws_url: String,
    pub room_name: String,
    pub meeting_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StartRecordingResp {
    pub recording_id: Uuid,
    pub status: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct AiResultResp {
    pub content: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct MomResp {
    pub key_points: Option<Vec<String>>,
    pub action_items: Option<Vec<String>>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TopicCoverageResp {
    pub topic_name: String,
    pub time_spent_seconds: i32,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct CourseResp {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub teacher_id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardDataResp {
    pub courses: Vec<CourseResp>,
    pub upcoming_meetings: Vec<MeetingResp>,
    pub recent_recordings: Vec<serde_json::Value>, // Placeholder for recordings
    pub stats: serde_json::Value,
}
