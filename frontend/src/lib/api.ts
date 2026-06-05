const API_URL = import.meta.env.VITE_API_URL || '';

interface ApiError {
  message: string;
}

function getAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function handleResponse(res: Response) {
  const data = await res.json().catch(() => ({ message: 'Unerwarteter Serverfehler.' }));
  if (!res.ok) throw data as ApiError;
  return data;
}

export async function apiPost(path: string, body?: unknown, token?: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse(res);
}

export async function apiGet(path: string, token?: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse(res);
}

export async function apiDelete(path: string, token?: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });
  return handleResponse(res);
}
