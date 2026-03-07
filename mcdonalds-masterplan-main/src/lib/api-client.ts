const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('admin_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('admin_token', token);
    } else {
      localStorage.removeItem('admin_token');
    }
  }

  getToken() {
    return this.token || localStorage.getItem('admin_token');
  }

  private async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData (browser sets it with boundary)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || body.error || `Request failed: ${res.status}`);
    }

    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text);
  }

  get<T = any>(path: string) {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T = any>(path: string, body?: any) {
    return this.request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    });
  }

  put<T = any>(path: string, body?: any) {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body ?? {}),
    });
  }

  delete<T = any>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }

  upload<T = any>(path: string, formData: FormData) {
    return this.request<T>(path, {
      method: 'POST',
      body: formData,
    });
  }

  getApiUrl() {
    return API_URL;
  }

  createEventSource(path: string): EventSource {
    return new EventSource(`${API_URL}${path}`);
  }
}

export const api = new ApiClient();
export { API_URL };
