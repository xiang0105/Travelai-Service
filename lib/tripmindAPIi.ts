// TripMind API client
// 提供四個簡潔的函式以呼叫後端路由：
// GET /health
// POST /chat/init_with_front_data
// POST /chat/message
// POST /ai/plan_flow

type ApiResponse<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

// 預設使用你提供的 ngrok URL，環境變數 TRIPMIND_API_BASE 仍可覆蓋
const FALLBACK_NGROK = 'https://e3cb35ae0b6c.ngrok-free.app';
const DEFAULT_BASE = (typeof process !== 'undefined' && process.env.TRIPMIND_API_BASE)
  ? process.env.TRIPMIND_API_BASE
  : FALLBACK_NGROK;

const jsonHeaders = { 'Content-Type': 'application/json' };

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const base = DEFAULT_BASE;
  const url = `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let payload: any = undefined;
    try { payload = text ? JSON.parse(text) : undefined; } catch { payload = text; }
    if (!res.ok) {
      // debug: include request/response details for non-2xx
      try {
        console.error('[TripMindAPI] Request failed', {
          url,
          status: res.status,
          options: { method: options.method, headers: options.headers, bodyPreview: (options.body ? String(options.body).slice(0, 1000) : undefined) },
          responseText: text,
        });
      } catch (e) { /* ignore logging errors */ }
      return { ok: false, status: res.status, error: payload?.error || payload || res.statusText };
    }
    return { ok: true, status: res.status, data: payload };
  } catch (err: any) {
    try {
      console.error('[TripMindAPI] Network/exception', { url, options, error: err });
    } catch (e) { /* ignore */ }
    return { ok: false, status: 0, error: err?.message || String(err) };
  }
}

// 1) 健康檢查
export const health = async (): Promise<ApiResponse<any>> => {
  return request('/health', { method: 'GET' });
};

// 2) 初始化 chat（帶前端資料）
export const initChat = async (frontData: any): Promise<ApiResponse<any>> => {
  return request('/chat/init_with_front_data', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(frontData),
  });
};

// 3) 傳送 chat 訊息
export const sendMessage = async (messageData: any): Promise<ApiResponse<any>> => {
  return request('/chat/message', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(messageData),
  });
};

// 4) 執行規劃流程
export const planFlow = async (flowData: any): Promise<ApiResponse<any>> => {
  return request('/ai/plan_flow', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(flowData),
  });
};

export default {
  health,
  initChat,
  sendMessage,
  planFlow,
};
