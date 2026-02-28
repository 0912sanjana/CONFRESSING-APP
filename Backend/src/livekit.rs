use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
struct LiveKitClaims {
    // Standard JWT fields
    iss: String,     // api key
    sub: String,     // identity
    iat: usize,
    exp: usize,

    // LiveKit expected
    name: Option<String>,
    video: VideoGrant,

    // Optional metadata
    metadata: Option<String>,

    // optional: other claims
    #[serde(flatten)]
    extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideoGrant {
    room: String,
    room_join: bool,
    can_publish: bool,
    can_subscribe: bool,
    can_publish_data: bool,

    // host controls (admin)
    room_admin: bool,
}

pub fn generate_livekit_token(
    api_key: &str,
    api_secret: &str,
    room_name: &str,
    identity: &str,
    role: &str,
    ttl_seconds: i64,
    meeting_id: Uuid,
) -> Result<String, String> {
    let now = chrono::Utc::now().timestamp() as usize;
    let exp = (chrono::Utc::now().timestamp() + ttl_seconds) as usize;

    let is_teacher = role.eq_ignore_ascii_case("teacher");

    let claims = LiveKitClaims {
        iss: api_key.to_string(),
        sub: identity.to_string(),
        iat: now,
        exp,
        name: Some(identity.to_string()),
        metadata: Some(format!(r#"{{"meeting_id":"{}","role":"{}"}}"#, meeting_id, role)),
        video: VideoGrant {
            room: room_name.to_string(),
            room_join: true,
            can_publish: true,
            can_subscribe: true,
            can_publish_data: true,
            room_admin: is_teacher,
        },
        extra: HashMap::new(),
    };

    let mut header = Header::new(Algorithm::HS256);
    header.typ = Some("JWT".to_string());

    let token = encode(
    &header,
    &claims,
    &EncodingKey::from_secret(api_secret.as_bytes()),
).map_err(|e| e.to_string())?;

Ok(token)
}