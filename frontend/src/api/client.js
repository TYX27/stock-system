const BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('stock_token') || '';
}

export function setToken(token) {
  if (token) localStorage.setItem('stock_token', token);
  else localStorage.removeItem('stock_token');
}

export function setUser(user) {
  if (user) localStorage.setItem('stock_user', JSON.stringify(user));
  else localStorage.removeItem('stock_user');
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('stock_user') || 'null');
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    const err = new Error(data.error || 'Login required');
    err.status = 401;
    throw err;
  }
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  health: () => request('/health'),
  auth: {
    login: (username, password) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    me: () => request('/auth/me'),
    listUsers: () => request('/auth/users'),
    createUser: (body) =>
      request('/auth/users', { method: 'POST', body: JSON.stringify(body) }),
    updateUser: (id, body) =>
      request(`/auth/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteUser: (id) =>
      request(`/auth/users/${id}`, { method: 'DELETE' }),
  },
  branches: {
    list: () => request('/branches'),
    create: (name) => request('/branches', { method: 'POST', body: JSON.stringify({ name }) }),
    remove: (id) => request(`/branches/${id}`, { method: 'DELETE' }),
  },
  items: {
    list: () => request('/items'),
    create: (body) => request('/items', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  },
  transactions: {
    list: () => request('/transactions'),
    create: (body) => request('/transactions', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
  },
  serials: {
    list: (status) => request(`/serials${status && status !== 'all' ? `?status=${status}` : ''}`),
    create: (body) => request('/serials', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => request(`/serials/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id) => request(`/serials/${id}`, { method: 'DELETE' }),
  },
  reports: {
    branchAnalysis: () => request('/reports/branch-analysis'),
    monthly: (year, month) => request(`/reports/monthly?year=${year}&month=${month}`),
    ranking: () => request('/reports/ranking'),
    byCategory: () => request('/reports/by-category'),
  },
};
