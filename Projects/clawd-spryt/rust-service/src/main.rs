use axum::{
    extract::Json,
    response::IntoResponse,
    routing::{get, post},
    Router,
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    service: String,
    port: u16,
}

#[derive(Deserialize)]
struct ProcessRequest {
    data: String,
}

#[derive(Serialize)]
struct ProcessResponse {
    success: bool,
    result: String,
    processed_length: usize,
}

async fn health() -> impl IntoResponse {
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "rust".to_string(),
        port: 8080,
    })
}

async fn process(
    Json(payload): Json<ProcessRequest>,
) -> impl IntoResponse {
    let processed = payload.data.to_uppercase();
    let length = processed.len();
    
    println!("Rust processing: {} bytes", length);
    
    (
        StatusCode::OK,
        Json(ProcessResponse {
            success: true,
            result: processed,
            processed_length: length,
        })
    )
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/health", get(health))
        .route("/api/process", post(process));
    
    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    println!("Rust service running on port 8080");
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
