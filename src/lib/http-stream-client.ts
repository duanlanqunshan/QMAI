/**
 * HTTP/1.1 streaming fetch via a custom Tauri command.
 *
 * Background: tauri-plugin-http uses reqwest with rustls + h2,
 * which negotiates HTTP/2 via ALPN. Some endpoints (notably
 * integrate.api.nvidia.com) fail at the HTTP/2 protocol layer with
 * rustls, producing "error sending request for url". This module
 * provides a drop-in fetch() replacement that uses a standalone
 * reqwest Client with http1_only(), streaming chunks back via
 * Tauri events.
 *
 * The returned Response interface matches the web standard:
 *   - .status, .headers available immediately
 *   - .body is a ReadableStream<Uint8Array>
 *   - AbortSignal support via http_fetch_cancel command
 */
import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"

// ── Event payload types (mirrors Rust HttpStream* structs) ──────────

interface StreamResponsePayload {
  request_id: string
  status: number
  headers: [string, string][]
}

interface StreamChunkPayload {
  request_id: string
  chunk: number[] // Vec<u8> → number[]
}

interface StreamEndPayload {
  request_id: string
}

interface StreamErrorPayload {
  request_id: string
  error: string
}

// ── Internal state per request ─────────────────────────────────────

let nextId = 0

interface QueuedItem {
  type: "chunk"
  data: Uint8Array
}

interface PendingState {
  responseMeta: {
    resolve: (meta: { status: number; headers: Headers }) => void
    reject: (err: Error) => void
  } | null
  queue: (QueuedItem | "end" | Error)[]
  queueWaiter: (() => void) | null
  cleanup: () => void
  aborted: boolean
}

/**
 * Returns a fetch-compatible function that routes POST requests
 * through the custom HTTP/1.1 streaming command.
 */
export function createHttpStreamFetch(): typeof globalThis.fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url
    const signal = init?.signal
    const method = (init?.method ?? "GET").toUpperCase()

    // Build header pairs for IPC
    const headerPairs: [string, string][] = []
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => headerPairs.push([k, v]))
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers) headerPairs.push([k, v])
      } else {
        for (const [k, v] of Object.entries(init.headers)) {
          if (v != null) headerPairs.push([k, v])
        }
      }
    }

    // Serialize body
    let bodyStr: string
    if (init?.body) {
      const result = readBodyAsString(init.body)
      bodyStr = result instanceof Promise ? await result : result
    } else {
      bodyStr = ""
    }

    const requestId = `hs-${Date.now()}-${++nextId}`

    if (signal?.aborted) {
      throw new DOMException("The user aborted a request.", "AbortError")
    }

    // ── Pending state ────────────────────────────────
    const state: PendingState = {
      responseMeta: null,
      queue: [],
      queueWaiter: null,
      cleanup: () => {},
      aborted: false,
    }

    // responseMetaPromise resolves when http-stream-response event arrives
    const responseMetaPromise = new Promise<{ status: number; headers: Headers }>(
      (resolve, reject) => {
        state.responseMeta = { resolve, reject }
      },
    )

    // ── Event listeners ──────────────────────────────
    const unlisteners: UnlistenFn[] = []
    const cleanup = () => {
      for (const fn of unlisteners) fn()
      unlisteners.length = 0
    }
    state.cleanup = cleanup

    // Abort signal handler
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          state.aborted = true
          invoke("http_fetch_cancel", { requestId }).catch(() => {})
          cleanup()
          state.responseMeta?.reject(
            new DOMException("The user aborted a request.", "AbortError"),
          )
          state.responseMeta = null
          // Push abort into queue so any active ReadableStream reader wakes up
          state.queue.push(new DOMException("The user aborted a request.", "AbortError"))
          state.queueWaiter?.()
        },
        { once: true },
      )
    }

    // Listen: response metadata
    unlisteners.push(
      await listen<StreamResponsePayload>("http-stream-response", (event) => {
        if (event.payload.request_id !== requestId) return
        const headers = new Headers(event.payload.headers)
        state.responseMeta?.resolve({ status: event.payload.status, headers })
        state.responseMeta = null
      }),
    )

    // Listen: body chunks
    unlisteners.push(
      await listen<StreamChunkPayload>("http-stream-chunk", (event) => {
        if (event.payload.request_id !== requestId) return
        state.queue.push({ type: "chunk", data: new Uint8Array(event.payload.chunk) })
        state.queueWaiter?.()
      }),
    )

    // Listen: stream end
    unlisteners.push(
      await listen<StreamEndPayload>("http-stream-end", (event) => {
        if (event.payload.request_id !== requestId) return
        state.queue.push("end")
        state.queueWaiter?.()
        cleanup()
      }),
    )

    // Listen: stream error
    unlisteners.push(
      await listen<StreamErrorPayload>("http-stream-error", (event) => {
        if (event.payload.request_id !== requestId) return
        const err = new Error(event.payload.error)
        // If response meta hasn't arrived, reject the fetch
        state.responseMeta?.reject(err)
        state.responseMeta = null
        state.queue.push(err)
        state.queueWaiter?.()
        cleanup()
      }),
    )

    // ── Fire the Rust command (returns immediately) ──
    invoke("http_fetch_stream", {
      request: {
        url,
        method,
        headers: headerPairs,
        body: bodyStr,
        request_id: requestId,
      },
    }).catch((err) => {
      if (state.aborted) return
      const error = new Error(String(err))
      state.responseMeta?.reject(error)
      state.responseMeta = null
      state.queue.push(error)
      state.queueWaiter?.()
      cleanup()
    })

    // ── Wait for response metadata ───────────────────
    const { status, headers } = await responseMetaPromise

    // ── Build ReadableStream body ────────────────────
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (state.queue.length > 0) {
          deliverNext(state, controller)
          return
        }
        // Wait for next event
        await new Promise<void>((resolve) => {
          state.queueWaiter = () => {
            state.queueWaiter = null
            resolve()
          }
        })
        deliverNext(state, controller)
      },
      cancel() {
        state.aborted = true
        invoke("http_fetch_cancel", { requestId }).catch(() => {})
        cleanup()
      },
    })

    return new Response(body, { status, headers })
  }
}

function deliverNext(
  state: PendingState,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const item = state.queue.shift()
  if (item === undefined) return
  if (item === "end") {
    controller.close()
  } else if (item instanceof Error) {
    controller.error(item)
  } else {
    controller.enqueue(item.data)
  }
}

function readBodyAsString(body: NonNullable<RequestInit["body"]>): string | Promise<string> {
  if (typeof body === "string") return body
  if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
    return new TextDecoder().decode(body)
  }
  if (body instanceof DataView) {
    return new TextDecoder().decode(body.buffer)
  }
  if (
    typeof body === "object" &&
    body !== null &&
    "text" in body &&
    typeof (body as unknown as Record<string, unknown>).text === "function"
  ) {
    return (body as Blob).text()
  }
  return String(body)
}

// ── Singleton (lazily created) ─────────────────────────────────────

let cachedFetch: typeof globalThis.fetch | null = null

export function shouldUseHttpStreamFetch(url: string, init?: RequestInit): boolean {
  const method = (init?.method ?? "GET").toUpperCase()
  if (method !== "POST") return false

  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    // Only route chat completions through the HTTP/1.1 stream client.
    // Embedding / model-list / rerank endpoints use the same host but
    // are NOT SSE streams — the custom client would mishandle them.
    return host === "integrate.api.nvidia.com" && path.endsWith("/chat/completions")
  } catch {
    return false
  }
}

export function getHttpStreamFetchIfAvailable(): typeof globalThis.fetch | null {
  if (cachedFetch) return cachedFetch
  try {
    // Only available inside Tauri — the import will throw in tests / SSR
    cachedFetch = createHttpStreamFetch()
    return cachedFetch
  } catch {
    return null
  }
}
