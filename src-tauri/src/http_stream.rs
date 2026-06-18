//! HTTP/1.1 streaming fetch command — bypasses tauri-plugin-http's
//! reqwest client (which negotiates HTTP/2 via ALPN) and uses a
//! standalone reqwest client configured with http1_only(). Fixes
//! "error sending request for url" on NVIDIA NIM endpoints where
//! the rustls + h2 stack hits a protocol-level incompatibility.
//!
//! Architecture:
//!   Frontend calls invoke("http_fetch_stream", { request })
//!     → Command spawns a tokio task and returns immediately
//!     → Task opens a reqwest connection with http1_only()
//!     → Response metadata (status, headers) emitted as event
//!     → Body chunks streamed as events
//!     → Stream-end or error event closes the stream
//!   Frontend calls invoke("http_fetch_cancel", { requestId })
//!     → Aborts the in-flight task via oneshot channel

use futures::StreamExt;
use reqwest::ClientBuilder;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

// ── Serializable types ────────────────────────────────────────────

type HeaderPairs = Vec<(String, String)>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpStreamRequest {
    pub url: String,
    pub method: String,
    pub headers: HeaderPairs,
    pub body: String,
    pub request_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct HttpStreamResponse {
    pub request_id: String,
    pub status: u16,
    pub headers: HeaderPairs,
}

#[derive(Debug, Clone, Serialize)]
pub struct HttpStreamChunk {
    pub request_id: String,
    pub chunk: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HttpStreamEnd {
    pub request_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct HttpStreamError {
    pub request_id: String,
    pub error: String,
}

// ── Abort-handle registry ─────────────────────────────────────────

pub struct HttpStreamState {
    pub abort_handles: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<()>>>>,
}

impl Default for HttpStreamState {
    fn default() -> Self {
        Self {
            abort_handles: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// ── Commands ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn http_fetch_stream(
    app: AppHandle,
    state: tauri::State<'_, HttpStreamState>,
    request: HttpStreamRequest,
) -> Result<(), String> {
    let (abort_tx, abort_rx) = tokio::sync::oneshot::channel::<()>();

    {
        let mut handles = state
            .abort_handles
            .lock()
            .map_err(|e| format!("lock poison: {e}"))?;
        handles.insert(request.request_id.clone(), abort_tx);
    }

    let handles = Arc::clone(&state.abort_handles);
    // Spawn the stream on a background task so this command returns
    // immediately. The frontend receives metadata and chunks via events.
    tokio::spawn(async move {
        let result = run_stream(app, request, abort_rx).await;

        // Clean up the abort handle regardless of outcome
        if let Ok(mut h) = handles.lock() {
            h.remove(&result.request_id);
        }

        // If run_stream returned an error before emitting an error event
        // (client build failure, header parse failure), emit it now so
        // the frontend doesn't hang waiting for a response-meta event.
        // Normal HTTP errors and stream errors are already emitted inside
        // run_stream — this only fires for the pre-flight failures.
        if let Some(ref err) = result.late_error {
            let _ = result.app_for_late_err.emit(
                "http-stream-error",
                HttpStreamError {
                    request_id: result.request_id.clone(),
                    error: err.clone(),
                },
            );
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn http_fetch_cancel(
    state: tauri::State<'_, HttpStreamState>,
    request_id: String,
) -> Result<(), String> {
    let mut handles = state
        .abort_handles
        .lock()
        .map_err(|e| format!("lock poison: {e}"))?;
    if let Some(tx) = handles.remove(&request_id) {
        let _ = tx.send(());
    }
    Ok(())
}

// ── Stream runner ─────────────────────────────────────────────────

struct StreamResult {
    request_id: String,
    /// Error that happened before any event could be emitted — the
    /// caller (the spawned task) is responsible for emitting it.
    late_error: Option<String>,
    app_for_late_err: AppHandle,
}

async fn run_stream(
    app: AppHandle,
    request: HttpStreamRequest,
    mut abort_rx: tokio::sync::oneshot::Receiver<()>,
) -> StreamResult {
    let rid = request.request_id.clone();

    let client = match ClientBuilder::new()
        .http1_only()
        .timeout(std::time::Duration::from_secs(30 * 60))
        .connect_timeout(std::time::Duration::from_secs(30))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return StreamResult {
                request_id: rid,
                late_error: Some(format!("无法创建HTTP客户端: {e}")),
                app_for_late_err: app,
            };
        }
    };

    let mut header_map = reqwest::header::HeaderMap::new();
    for (k, v) in &request.headers {
        let name = match reqwest::header::HeaderName::from_bytes(k.as_bytes()) {
            Ok(n) => n,
            Err(e) => {
                return StreamResult {
                    request_id: rid,
                    late_error: Some(format!("无效的请求头名称 '{k}': {e}")),
                    app_for_late_err: app,
                };
            }
        };
        let value = match reqwest::header::HeaderValue::from_str(v) {
            Ok(val) => val,
            Err(e) => {
                return StreamResult {
                    request_id: rid,
                    late_error: Some(format!("无效的请求头值 '{v}': {e}")),
                    app_for_late_err: app,
                };
            }
        };
        header_map.insert(name, value);
    }

    // ── Send request ─────────────────────────────────
    let method = match reqwest::Method::from_bytes(request.method.as_bytes()) {
        Ok(method) => method,
        Err(e) => {
            return StreamResult {
                request_id: rid,
                late_error: Some(format!("无效的HTTP方法 '{}': {e}", request.method)),
                app_for_late_err: app,
            };
        }
    };

    let mut request_builder = client.request(method, &request.url).headers(header_map);
    if !request.body.is_empty() {
        request_builder = request_builder.body(request.body.clone());
    }

    let response = match request_builder.send().await {
        Ok(r) => r,
        Err(e) => {
            let msg = format!("HTTP请求失败: {e}");
            let _ = app.emit(
                "http-stream-error",
                HttpStreamError {
                    request_id: rid.clone(),
                    error: msg.clone(),
                },
            );
            return StreamResult {
                request_id: rid,
                late_error: None,
                app_for_late_err: app,
            };
        }
    };

    // ── Emit response metadata ───────────────────────
    let status = response.status().as_u16();
    let resp_headers: HeaderPairs = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let _ = app.emit(
        "http-stream-response",
        HttpStreamResponse {
            request_id: rid.clone(),
            status,
            headers: resp_headers,
        },
    );

    // ── Stream body chunks ───────────────────────────
    let mut byte_stream = response.bytes_stream();
    loop {
        tokio::select! {
            _ = &mut abort_rx => {
                return StreamResult {
                    request_id: rid,
                    late_error: None,
                    app_for_late_err: app,
                };
            }
            chunk = byte_stream.next() => {
                match chunk {
                    Some(Ok(bytes)) => {
                        let _ = app.emit(
                            "http-stream-chunk",
                            HttpStreamChunk {
                                request_id: rid.clone(),
                                chunk: bytes.to_vec(),
                            },
                        );
                    }
                    Some(Err(e)) => {
                        let msg = format!("流读取错误: {e}");
                        let _ = app.emit(
                            "http-stream-error",
                            HttpStreamError {
                                request_id: rid.clone(),
                                error: msg.clone(),
                            },
                        );
                        return StreamResult {
                            request_id: rid,
                            late_error: None,
                            app_for_late_err: app,
                        };
                    }
                    None => break,
                }
            }
        }
    }

    let _ = app.emit(
        "http-stream-end",
        HttpStreamEnd {
            request_id: rid.clone(),
        },
    );

    StreamResult {
        request_id: rid,
        late_error: None,
        app_for_late_err: app,
    }
}
