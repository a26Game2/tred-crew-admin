export type User = { id: string; fullName: string; email: string; username?: string; role: string; status: string };
export type Session = { accessToken: string; refreshToken: string; user: User };
export type Envelope<T = any> = { success: boolean; data: T; meta?: { page: number; pageSize: number; total: number; totalPages: number } };
const key = 'tred-admin-session';
const apiBase = import.meta.env.DEV ? '/api/v1' : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');
export function getSession(): Session | null { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } }
export function saveSession(value: Session | null) { if (value) sessionStorage.setItem(key, JSON.stringify(value)); else sessionStorage.removeItem(key); window.dispatchEvent(new Event('tred-session')); }
export class ApiError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } }
let refreshing: Promise<Session> | null = null;
async function refresh(): Promise<Session> {
  if (!refreshing) refreshing = (async () => { const current = getSession(); if (!current) throw new ApiError('Phiên đăng nhập đã hết hạn.', 401); const response = await fetch(`${apiBase}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: current.refreshToken }) }); const result = await response.json(); if (!response.ok || result.data?.user?.role !== 'ADMIN') { saveSession(null); throw new ApiError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401); } saveSession(result.data); return result.data as Session; })().finally(() => { refreshing = null; });
  return refreshing;
}
export async function request<T = any>(path: string, options: { method?: string; body?: unknown; auth?: boolean; raw?: boolean } = {}): Promise<Envelope<T>> {
  const make = (token?: string) => fetch(`${apiBase}${path}`, { method: options.method || 'GET', headers: { ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}) });
  let response = await make(options.auth === false ? undefined : getSession()?.accessToken);
  if (response.status === 401 && options.auth !== false && getSession()?.refreshToken) { const session = await refresh(); response = await make(session.accessToken); }
  if (options.raw && response.ok) return { success: true, data: await response.blob() as T };
  let body: any; try { body = await response.json(); } catch { throw new ApiError(`Máy chủ trả về dữ liệu không hợp lệ (${response.status}).`, response.status); }
  if (!response.ok) throw new ApiError(body.error?.message || `Không thể thực hiện yêu cầu (${response.status}).`, response.status, body.error?.code);
  return body as Envelope<T>;
}
export async function login(identifier: string, password: string) { const { data } = await request<Session>('/auth/login', { method: 'POST', body: { identifier, password }, auth: false }); if (data.user.role !== 'ADMIN') { await request('/auth/logout', { method: 'POST', body: { refreshToken: data.refreshToken }, auth: false }).catch(() => {}); throw new Error('Trang quản trị chỉ dành cho tài khoản admin.'); } saveSession(data); return data; }
export async function logout() { const current = getSession(); saveSession(null); if (current) await request('/auth/logout', { method: 'POST', body: { refreshToken: current.refreshToken }, auth: false }).catch(() => {}); }
export const query = (obj: Record<string, string | number | undefined>) => { const q = new URLSearchParams(); Object.entries(obj).forEach(([key, value]) => { if (value !== undefined && value !== '') q.set(key, String(value)); }); return q.toString() ? `?${q}` : ''; };
