import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, setToken, setUser, getUser } from './api/client';

const TABS = [
  { id: 'stock', label: 'Stock Master' },
  { id: 'log', label: 'Transaction Log' },
  { id: 'serials', label: 'Phone / Serial IC' },
  { id: 'branch', label: 'Branch Analysis' },
  { id: 'monthly', label: 'Monthly Usage' },
  { id: 'ranking', label: 'Branch Ranking' },
  { id: 'category', label: 'By Category' },
  { id: 'lists', label: 'Lists / Settings' },
  { id: 'users', label: 'Users' },
];

const pad = (n) => String(n).padStart(2, '0');
const years = [2026, 2027, 2028, 2029, 2030];
const months = Array.from({ length: 12 }, (_, i) => i + 1);
const days = Array.from({ length: 31 }, (_, i) => i + 1);
const hours = Array.from({ length: 24 }, (_, i) => pad(i));
const mins = Array.from({ length: 60 }, (_, i) => pad(i));

function stampNow() {
  const n = new Date();
  return {
    year: n.getFullYear(),
    month: n.getMonth() + 1,
    day: n.getDate(),
    hour: pad(n.getHours()),
    min: pad(n.getMinutes()),
  };
}

function isSerialItem(name, category = '') {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();
  if (c.includes('mobile') || c.includes('phone') || c.includes('printer')) return true;
  return /phone|galaxy|realme|huawei|motorola|oneplus|monitor|printer|toner|hprt|epson|brother|lenovo/i.test(n);
}


function UsersAdmin({ showToast, isAdmin, currentUserId, onSelfUpdated }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', displayName: '', role: 'user' });
  const [showCreatePw, setShowCreatePw] = useState(false);
  const [showEditPw, setShowEditPw] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    username: '',
    displayName: '',
    role: 'user',
    active: true,
    password: '',
  });

  async function load() {
    try {
      setList(await api.auth.listUsers());
    } catch (e) {
      showToast(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    try {
      await api.auth.createUser(form);
      showToast('User created');
      setForm({ username: '', password: '', displayName: '', role: 'user' });
      load();
    } catch (ex) {
      showToast(ex.message);
    }
  }

  function startEdit(u) {
    setEditId(u.id);
    setEditForm({
      username: u.username || '',
      displayName: u.displayName || '',
      role: u.role,
      active: !!u.active,
      password: '',
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      const body = {
        username: (editForm.username || '').trim(),
        displayName: editForm.displayName,
        role: editForm.role,
        active: editForm.active,
      };
      if (!body.username) {
        showToast('Username cannot be empty');
        return;
      }
      if (editForm.password && editForm.password.length >= 4) {
        body.password = editForm.password;
      }
      const updated = await api.auth.updateUser(editId, body);
      showToast('User updated');
      // If admin edited their own account, refresh header name / local user
      if (editId === currentUserId && onSelfUpdated) {
        onSelfUpdated({
          id: updated.id,
          username: updated.username,
          displayName: updated.displayName,
          role: updated.role,
        });
      }
      setEditId(null);
      load();
    } catch (ex) {
      showToast(ex.message);
    }
  }

  async function deleteUser(id, username) {
    const isSelf = id === currentUserId;
    const msg = isSelf
      ? `Delete YOUR OWN account "${username}"? You will be logged out. This cannot be undone.`
      : `Delete user "${username}"? This cannot be undone.`;
    if (!confirm(msg)) return;
    if (isSelf && !confirm('Are you sure? There must be another admin or you will lock yourself out.')) return;
    try {
      await api.auth.deleteUser(id);
      showToast('User deleted');
      if (editId === id) setEditId(null);
      if (isSelf) {
        setToken(null);
        setUser(null);
        window.location.reload();
        return;
      }
      load();
    } catch (ex) {
      showToast(ex.message);
    }
  }

  return (
    <div className="card">
      <h2>👥 Users</h2>
      <p className="hint">
        {isAdmin
          ? 'Admin can create, edit, and delete any account (including your own). Passwords are stored encrypted — you cannot see old passwords, only set a new one. Use the eye button to show what you type.'
          : 'View-only. Only admin can create, edit, or delete users.'}
      </p>

      {isAdmin && (
        <form onSubmit={create} className="form-grid">
          <div><label>Username</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
          <div>
            <label>Password</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type={showCreatePw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={4}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCreatePw((v) => !v)}>
                {showCreatePw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div><label>Display name</label><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></div>
          <div><label>Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <button type="submit" className="btn btn-green">Create user</button>
          </div>
        </form>
      )}

      {isAdmin && editId && (
        <form onSubmit={saveEdit} className="form-grid" style={{ marginTop: 16, padding: 12, background: '#f0f7ff', borderRadius: 8 }}>
          <div style={{ gridColumn: 'span 2' }}><strong>Editing user #{editId}</strong></div>
          <div>
            <label>Username (login)</label>
            <input
              value={editForm.username}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
              required
            />
          </div>
          <div>
            <label>Display name</label>
            <input
              value={editForm.displayName}
              onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
            />
          </div>
          <div><label>Role</label>
            <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div><label>Active</label>
            <select value={editForm.active ? '1' : '0'} onChange={(e) => setEditForm({ ...editForm, active: e.target.value === '1' })}>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label>New password (optional — old password cannot be shown, only replaced)</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type={showEditPw ? 'text' : 'password'}
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                minLength={4}
                placeholder="Leave blank to keep current password"
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowEditPw((v) => !v)}>
                {showEditPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-primary">Save changes</button>
            <button type="button" className="btn btn-outline" onClick={() => setEditId(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="scroll" style={{ marginTop: 16 }}>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Role</th>
              <th>Active</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td><b>{u.username}</b></td>
                <td>{u.displayName}</td>
                <td>{u.role}</td>
                <td>{u.active ? 'Yes' : 'No'}</td>
                {isAdmin && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => startEdit(u)}>Edit</button>{' '}
                    <button className="btn btn-red btn-sm" onClick={() => deleteUser(u.id, u.username)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {!list.length && (
              <tr><td colSpan={isAdmin ? 5 : 4} className="empty">No users</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const data = await api.auth.login(username.trim(), password);
      setToken(data.token);
      setUser(data.user);
      onLogin(data.user);
    } catch (ex) {
      setErr(ex.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1f4e79,#0088ff)' }}>
      <form onSubmit={submit} style={{ background: '#fff', padding: 32, borderRadius: 16, width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,.2)' }}>
        <h1 style={{ fontSize: '1.3rem', marginBottom: 8, color: '#1f4e79' }}>📦 Stock System Login</h1>
        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 20 }}>Sign in to continue</p>
        {err && <div className="error-banner">{err}</div>}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>USERNAME</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: '1rem' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>PASSWORD</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: '1rem' }} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%', padding: 12 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p style={{ marginTop: 16, fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' }}>
          Default admin: <b>admin</b> / <b>admin123</b>
        </p>
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUserState] = useState(() => getUser());
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('stock');
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [txns, setTxns] = useState([]);
  const [serials, setSerials] = useState([]);
  const [branchReport, setBranchReport] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [byCat, setByCat] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [serialFilter, setSerialFilter] = useState('all');
  const [serialSearch, setSerialSearch] = useState('');
  const [mYear, setMYear] = useState(2026);
  const [mMonth, setMMonth] = useState(10);

  const emptyForm = () => ({
    ...stampNow(),
    branch: '',
    item: '',
    type: 'Take Out',
    qty: 1,
    notes: '',
    takenBy: '',
    recordedBy: '',
    serial: '',
  });
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const emptyReg = () => ({
    ...stampNow(),
    item: '',
    serial: '',
    branch: '',
    status: 'In Stock',
    takenBy: '',
    recordedBy: '',
    notes: '',
  });
  const [reg, setReg] = useState(emptyReg);
  const [editSerialId, setEditSerialId] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  function logout() {
    setToken(null);
    setUser(null);
    setUserState(null);
  }

  const loadCore = useCallback(async () => {
    if (!getUser()) return;
    try {
      setError('');
      const [it, br, tx] = await Promise.all([
        api.items.list(),
        api.branches.list(),
        api.transactions.list(),
      ]);
      setItems(it);
      setBranches(br);
      setTxns(tx);
      setForm((f) => ({
        ...f,
        branch: f.branch || br[0]?.name || '',
        item: f.item || it[0]?.name || '',
      }));
      setReg((r) => ({
        ...r,
        item: r.item || it.find((i) => isSerialItem(i.name, i.category))?.name || it[0]?.name || '',
        branch: r.branch || '',
      }));
      // keep existing editSerialId / reg if user is editing
    } catch (e) {
      if (e.status === 401) { logout(); return; }
      setError(e.message + ' — is the API running on port 4000?');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const [ba, mo, rk, cat, ser] = await Promise.all([
        api.reports.branchAnalysis(),
        api.reports.monthly(mYear, mMonth),
        api.reports.ranking(),
        api.reports.byCategory(),
        api.serials.list(serialFilter),
      ]);
      setBranchReport(ba);
      setMonthly(mo);
      setRanking(rk);
      setByCat(cat);
      setSerials(ser);
    } catch (e) {
      console.error(e);
    }
  }, [mYear, mMonth, serialFilter]);

  useEffect(() => {
    if (user) loadCore();
  }, [loadCore, user]);

  useEffect(() => {
    if (!loading) loadReports();
  }, [loading, loadReports, tab]);

  const stats = useMemo(() => {
    const totalUnits = items.reduce((s, i) => s + (i.current || 0), 0);
    const lowOut = items.filter((i) => i.status).length;
    return { totalUnits, lowOut };
  }, [items]);

  const filteredItems = items.filter(
    (i) =>
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredTxns = txns.filter((t) => {
    if (!logSearch) return true;
    const q = logSearch.toLowerCase();
    return [t.branch, t.item, t.type, t.notes, t.takenBy, t.recordedBy, t.serial]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const filteredSerials = serials.filter((s) => {
    if (!serialSearch) return true;
    const q = serialSearch.toLowerCase();
    return [s.serial, s.item, s.status, s.takenBy, s.recordedBy, s.branch, s.notes]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const serialItems = items.filter((i) => isSerialItem(i.name, i.category));

  async function saveTxn(e) {
    e?.preventDefault();
    try {
      const body = {
        year: +form.year,
        month: +form.month,
        day: +form.day,
        hour: form.hour,
        min: form.min,
        branch: form.branch,
        item: form.item,
        type: form.type,
        qty: +form.qty,
        notes: form.notes,
        takenBy: form.takenBy,
        recordedBy: form.recordedBy,
        serial: form.serial,
      };
      if (editId) {
        await api.transactions.update(editId, body);
        showToast('Transaction updated');
      } else {
        await api.transactions.create(body);
        showToast('Saved — date/time locked');
      }
      setEditId(null);
      setForm({ ...emptyForm(), branch: form.branch, item: form.item, recordedBy: form.recordedBy });
      await loadCore();
      await loadReports();
    } catch (err) {
      showToast(err.message);
    }
  }

  function startEdit(t) {
    setEditId(t.id);
    setForm({
      year: t.year,
      month: t.month,
      day: t.day,
      hour: t.hour,
      min: t.min,
      branch: t.branch,
      item: t.item,
      type: t.type,
      qty: t.qty,
      notes: t.notes || '',
      takenBy: t.takenBy || '',
      recordedBy: t.recordedBy || '',
      serial: t.serial || '',
    });
    setTab('log');
    showToast('Editing transaction #' + t.id);
  }

  async function deleteTxn(id) {
    if (!confirm('Delete this transaction?')) return;
    await api.transactions.remove(id);
    showToast('Deleted');
    await loadCore();
    await loadReports();
  }

  function startEditSerial(s) {
    setEditSerialId(s.id);
    setReg({
      year: s.year || new Date().getFullYear(),
      month: s.month || new Date().getMonth() + 1,
      day: s.day || new Date().getDate(),
      hour: s.hour != null ? String(s.hour).padStart(2, '0') : pad(new Date().getHours()),
      min: s.min != null ? String(s.min).padStart(2, '0') : pad(new Date().getMinutes()),
      item: s.item || '',
      serial: s.serial || '',
      branch: s.branch || '',
      status: s.status || 'In Stock',
      takenBy: s.takenBy || '',
      recordedBy: s.recordedBy || '',
      notes: s.notes || '',
    });
    showToast('Editing serial #' + s.id + ' — use the form above');
    // scroll form into view if possible
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEditSerial() {
    setEditSerialId(null);
    setReg((r) => ({
      ...emptyReg(),
      item: r.item || serialItems[0]?.name || items[0]?.name || '',
    }));
  }

  async function registerSerial(e) {
    e?.preventDefault();
    try {
      if (editSerialId) {
        await api.serials.update(editSerialId, reg);
        showToast('Serial updated');
        setEditSerialId(null);
        setReg((r) => ({
          ...emptyReg(),
          item: r.item,
          branch: r.branch,
        }));
      } else {
        await api.serials.create(reg);
        showToast('Serial registered: ' + reg.status);
        setReg((r) => ({
          ...r,
          ...stampNow(),
          serial: '',
          notes: '',
          takenBy: '',
        }));
      }
      await loadReports();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function markSerial(id, status) {
    let takenBy = '';
    let recordedBy = '';
    if (status === 'Taken Out') {
      takenBy = prompt('Taken By (person who takes this unit):', '') ?? '';
      if (takenBy === null) return;
      recordedBy = prompt('Recorded By:', '') ?? '';
      if (recordedBy === null) return;
    }
    const now = stampNow();
    await api.serials.update(id, {
      status,
      takenBy: status === 'Taken Out' ? takenBy : '',
      recordedBy: status === 'Taken Out' ? recordedBy : '',
      ...now,
    });
    showToast('Status: ' + status);
    await loadReports();
  }

  async function addBranch() {
    const name = prompt('New branch name:');
    if (!name?.trim()) return;
    await api.branches.create(name.trim());
    showToast('Branch added');
    await loadCore();
  }

  async function addItem() {
    const name = prompt('Item name:');
    if (!name?.trim()) return;
    const category = prompt('Category:', 'Computing Hardware') || 'Other';
    const starting = parseInt(prompt('Starting stock:', '0') || '0', 10) || 0;
    await api.items.create({ name: name.trim(), category, starting_stock: starting });
    showToast('Item added');
    await loadCore();
  }

  if (!user) {
    return <LoginPage onLogin={(u) => { setUserState(u); setLoading(true); }} />;
  }

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        Loading stock system…
      </div>
    );
  }

  return (
    <>
      <header>
        <h1>📦 Stock Inventory System</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ opacity: 0.9, fontSize: '0.85rem' }}>
            {user.displayName || user.username} ({user.role}) · {txns.length} txns
          </span>
          <button className="btn btn-outline btn-sm" onClick={logout} style={{ color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}>
            Logout
          </button>
        </div>
      </header>
      <nav>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main>
        {error && <div className="error-banner">{error}</div>}

        {tab === 'stock' && (
          <>
            <div className="stats">
              <div className="stat">
                <div className="num">{items.length}</div>
                <div className="label">Item Types</div>
              </div>
              <div className="stat">
                <div className="num">{stats.totalUnits}</div>
                <div className="label">Current Units</div>
              </div>
              <div className="stat warn">
                <div className="num">{stats.lowOut}</div>
                <div className="label">Low / Out</div>
              </div>
              <div className="stat">
                <div className="num">{branches.length}</div>
                <div className="label">Branches</div>
              </div>
              <div className="stat">
                <div className="num">{txns.length}</div>
                <div className="label">Transactions</div>
              </div>
            </div>
            <div className="card">
              <div className="toolbar">
                <input
                  type="search"
                  placeholder="Search item…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Item</th>
                      <th>Starting</th>
                      <th>Taken</th>
                      <th>Added</th>
                      <th>Current</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <span className="cat-tag">{i.category}</span>
                        </td>
                        <td>
                          <b>{i.name}</b>
                        </td>
                        <td>{i.starting}</td>
                        <td>{i.taken}</td>
                        <td>{i.added}</td>
                        <td>
                          <b>{i.current}</b>
                        </td>
                        <td
                          className={
                            i.status === 'No Stock' ? 'out' : i.status === 'LOW STOCK' ? 'low' : ''
                          }
                        >
                          {i.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'log' && (
          <>
            {isAdmin ? (
            <div className="card">
              <h2>{editId ? `✏️ Edit Transaction #${editId}` : '➕ Record Movement'}</h2>
              <p className="hint">
                Date & time are set when you open the form and <b>saved permanently</b> — they never
                change later. Taken By and Recorded By are separate.
              </p>
              <form onSubmit={saveTxn}>
                <div className="form-grid">
                  <div>
                    <label>Year</label>
                    <select
                      className="auto"
                      value={form.year}
                      onChange={(e) => setForm({ ...form, year: +e.target.value })}
                    >
                      {years.map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Month</label>
                    <select
                      className="auto"
                      value={form.month}
                      onChange={(e) => setForm({ ...form, month: +e.target.value })}
                    >
                      {months.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Day</label>
                    <select
                      className="auto"
                      value={form.day}
                      onChange={(e) => setForm({ ...form, day: +e.target.value })}
                    >
                      {days.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Hour</label>
                    <select
                      className="auto"
                      value={form.hour}
                      onChange={(e) => setForm({ ...form, hour: e.target.value })}
                    >
                      {hours.map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Min</label>
                    <select
                      className="auto"
                      value={form.min}
                      onChange={(e) => setForm({ ...form, min: e.target.value })}
                    >
                      {mins.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Branch</label>
                    <select
                      value={form.branch}
                      onChange={(e) => setForm({ ...form, branch: e.target.value })}
                    >
                      {branches.map((b) => (
                        <option key={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label>Item</label>
                    <select
                      value={form.item}
                      onChange={(e) => setForm({ ...form, item: e.target.value })}
                    >
                      {items.map((i) => (
                        <option key={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Type</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                      <option>Take Out</option>
                      <option>Add Stock</option>
                    </select>
                  </div>
                  <div>
                    <label>Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={form.qty}
                      onChange={(e) => setForm({ ...form, qty: e.target.value })}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label>Notes</label>
                    <input
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label>Taken By</label>
                    <input
                      value={form.takenBy}
                      onChange={(e) => setForm({ ...form, takenBy: e.target.value })}
                      placeholder="Who takes the item"
                    />
                  </div>
                  <div>
                    <label>Recorded By</label>
                    <input
                      value={form.recordedBy}
                      onChange={(e) => setForm({ ...form, recordedBy: e.target.value })}
                      placeholder="Who enters this record"
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label>IC / Serial (phones, monitors, printers)</label>
                    <input
                      value={form.serial}
                      onChange={(e) => setForm({ ...form, serial: e.target.value })}
                      placeholder="Optional — comma separate if multiple"
                    />
                  </div>
                </div>
                <div className="row-actions">
                  <button type="submit" className="btn btn-primary">
                    {editId ? '💾 Update Transaction' : '💾 Save Transaction'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setForm({ ...form, ...stampNow() })}
                  >
                    ↻ Refresh date/time
                  </button>
                  {editId && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        setEditId(null);
                        setForm(emptyForm());
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </div>
            ) : (
              <div className="card">
                <p className="hint">View-only mode. Only admin can record or edit transactions.</p>
              </div>
            )}
            <div className="card">
              <h2>📋 History</h2>
              <div className="toolbar">
                <input
                  type="search"
                  placeholder="Search…"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                />
              </div>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Branch</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>IC / Serial</th>
                      <th>Notes</th>
                      <th>Taken By</th>
                      <th>Recorded By</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxns.map((t, idx) => (
                      <tr key={t.id}>
                        <td>{filteredTxns.length - idx}</td>
                        <td>
                          {t.year}-{pad(t.month)}-{pad(t.day)}
                        </td>
                        <td>
                          {t.hour}:{t.min}
                        </td>
                        <td>
                          <b>{t.branch}</b>
                        </td>
                        <td>{t.item}</td>
                        <td
                          style={{
                            color: t.type === 'Take Out' ? '#e74c3c' : '#2ecc71',
                            fontWeight: 700,
                          }}
                        >
                          {t.type}
                        </td>
                        <td>
                          <b>{t.qty}</b>
                        </td>
                        <td>
                          {t.serial ? <span className="serial-badge">{t.serial}</span> : ''}
                        </td>
                        <td>{t.notes}</td>
                        <td>
                          <b>{t.takenBy}</b>
                        </td>
                        <td>{t.recordedBy}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {isAdmin && (
                            <>
                              <button className="btn btn-outline btn-sm" onClick={() => startEdit(t)}>
                                Edit
                              </button>{' '}
                              <button className="btn btn-red btn-sm" onClick={() => deleteTxn(t.id)}>
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!filteredTxns.length && (
                      <tr>
                        <td colSpan={12} className="empty">
                          No transactions
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'serials' && (
          <>
            {isAdmin ? (
            <div className="card">
              <h2>
                {editSerialId
                  ? `✏️ Edit IC / Serial #${editSerialId}`
                  : '📱 Register IC / Serial (Phones · Monitors · Printers)'}
              </h2>
              <p className="hint">
                {editSerialId
                  ? 'Update any field including date & time, then Save. Cancel to start a new registration.'
                  : 'For units already in stock without a serial. Date & time are saved permanently. Taken By and Recorded By are separate. Click Edit on a row below to change an existing entry.'}
              </p>
              <form onSubmit={registerSerial}>
                <div className="form-grid">
                  <div>
                    <label>Year</label>
                    <select
                      className="auto"
                      value={reg.year}
                      onChange={(e) => setReg({ ...reg, year: +e.target.value })}
                    >
                      {years.map((y) => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Month</label>
                    <select
                      className="auto"
                      value={reg.month}
                      onChange={(e) => setReg({ ...reg, month: +e.target.value })}
                    >
                      {months.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Day</label>
                    <select
                      className="auto"
                      value={reg.day}
                      onChange={(e) => setReg({ ...reg, day: +e.target.value })}
                    >
                      {days.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Hour</label>
                    <select
                      className="auto"
                      value={reg.hour}
                      onChange={(e) => setReg({ ...reg, hour: e.target.value })}
                    >
                      {hours.map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Min</label>
                    <select
                      className="auto"
                      value={reg.min}
                      onChange={(e) => setReg({ ...reg, min: e.target.value })}
                    >
                      {mins.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ marginTop: 22 }}
                      onClick={() => setReg({ ...reg, ...stampNow() })}
                    >
                      ↻ Now
                    </button>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label>Item</label>
                    <select
                      value={reg.item}
                      onChange={(e) => setReg({ ...reg, item: e.target.value })}
                    >
                      {(serialItems.length ? serialItems : items).map((i) => (
                        <option key={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label>IC / Serial</label>
                    <input
                      value={reg.serial}
                      onChange={(e) => setReg({ ...reg, serial: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label>Branch</label>
                    <select
                      value={reg.branch}
                      onChange={(e) => setReg({ ...reg, branch: e.target.value })}
                    >
                      <option value="">—</option>
                      {branches.map((b) => (
                        <option key={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Status</label>
                    <select
                      value={reg.status}
                      onChange={(e) => setReg({ ...reg, status: e.target.value })}
                    >
                      <option>In Stock</option>
                      <option>Taken Out</option>
                    </select>
                  </div>
                  <div>
                    <label>Taken By</label>
                    <input
                      value={reg.takenBy}
                      onChange={(e) => setReg({ ...reg, takenBy: e.target.value })}
                    />
                  </div>
                  <div>
                    <label>Recorded By</label>
                    <input
                      value={reg.recordedBy}
                      onChange={(e) => setReg({ ...reg, recordedBy: e.target.value })}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label>Notes</label>
                    <input
                      value={reg.notes}
                      onChange={(e) => setReg({ ...reg, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="row-actions">
                  <button type="submit" className="btn btn-green">
                    {editSerialId ? '💾 Update serial' : '＋ Register serial'}
                  </button>
                  {editSerialId && (
                    <button type="button" className="btn btn-outline" onClick={cancelEditSerial}>
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </div>
            ) : (
              <div className="card">
                <p className="hint">View-only mode. Only admin can register or change serials.</p>
              </div>
            )}
            <div className="card">
              <h2>All registered serials</h2>
              <div className="toolbar">
                <input
                  type="search"
                  placeholder="Search…"
                  value={serialSearch}
                  onChange={(e) => setSerialSearch(e.target.value)}
                />
                <select value={serialFilter} onChange={(e) => setSerialFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="In Stock">In Stock only</option>
                  <option value="Taken Out">Taken Out only</option>
                </select>
              </div>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>IC / Serial</th>
                      <th>Status</th>
                      <th>Branch</th>
                      <th>Taken By</th>
                      <th>Recorded By</th>
                      <th>Date</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSerials.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <b>{s.item}</b>
                        </td>
                        <td>
                          <span className="serial-badge">{s.serial}</span>
                        </td>
                        <td
                          style={{
                            fontWeight: 700,
                            color: s.status === 'In Stock' ? '#2ecc71' : '#e74c3c',
                          }}
                        >
                          {s.status}
                        </td>
                        <td>{s.branch}</td>
                        <td>
                          <b>{s.takenBy}</b>
                        </td>
                        <td>{s.recordedBy}</td>
                        <td>
                          {s.year}-{pad(s.month)}-{pad(s.day)} {s.hour}:{s.min}
                        </td>
                        <td>{s.notes}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {isAdmin && (
                            <>
                              <button
                                className="btn btn-outline btn-sm"
                                onClick={() => startEditSerial(s)}
                              >
                                Edit
                              </button>{' '}
                              {s.status === 'Taken Out' ? (
                                <button
                                  className="btn btn-green btn-sm"
                                  onClick={() => markSerial(s.id, 'In Stock')}
                                >
                                  Mark In Stock
                                </button>
                              ) : (
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => markSerial(s.id, 'Taken Out')}
                                >
                                  Mark Taken Out
                                </button>
                              )}{' '}
                              <button
                                className="btn btn-red btn-sm"
                                onClick={async () => {
                                  if (!confirm('Delete serial?')) return;
                                  await api.serials.remove(s.id);
                                  if (editSerialId === s.id) cancelEditSerial();
                                  await loadReports();
                                }}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!filteredSerials.length && (
                      <tr>
                        <td colSpan={9} className="empty">
                          No serials registered yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <h2>From transactions (history)</h2>
              <p className="hint">
                Serial numbers that appear in the transaction log (Take Out / Add Stock with IC filled in).
              </p>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Branch</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Qty</th>
                      <th>IC / Serial</th>
                      <th>Taken By</th>
                      <th>Recorded By</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns
                      .filter((t) => t.serial && String(t.serial).trim())
                      .map((t) => (
                        <tr key={'stx-' + t.id}>
                          <td>
                            {t.year}-{pad(t.month)}-{pad(t.day)}
                          </td>
                          <td>
                            {t.hour}:{t.min}
                          </td>
                          <td>
                            <b>{t.branch}</b>
                          </td>
                          <td>{t.item}</td>
                          <td
                            style={{
                              color: t.type === 'Take Out' ? '#e74c3c' : '#2ecc71',
                              fontWeight: 700,
                            }}
                          >
                            {t.type}
                          </td>
                          <td>
                            <b>{t.qty}</b>
                          </td>
                          <td>
                            <span className="serial-badge">{t.serial}</span>
                          </td>
                          <td>
                            <b>{t.takenBy}</b>
                          </td>
                          <td>{t.recordedBy}</td>
                          <td>{t.notes}</td>
                        </tr>
                      ))}
                    {!txns.some((t) => t.serial && String(t.serial).trim()) && (
                      <tr>
                        <td colSpan={10} className="empty">
                          No serial numbers in transaction log yet. Save a Take Out / Add with IC/Serial filled in.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'branch' && branchReport && (
          <div className="card">
            <h2>Branch Analysis – Units Taken</h2>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    {branchReport.branches.map((b) => (
                      <th key={b}>{b}</th>
                    ))}
                    <th>Total Taken</th>
                    <th>Total Added</th>
                  </tr>
                </thead>
                <tbody>
                  {branchReport.matrix.map((row) => (
                    <tr key={row.item}>
                      <td>
                        <b>{row.item}</b>
                      </td>
                      {branchReport.branches.map((b) => (
                        <td key={b}>{row.byBranch[b] || ''}</td>
                      ))}
                      <td>
                        <b>{row.totalTaken}</b>
                      </td>
                      <td>{row.totalAdded || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'monthly' && (
          <div className="card">
            <h2>Monthly Item Usage</h2>
            <div className="toolbar">
              <label>Year</label>
              <select value={mYear} onChange={(e) => setMYear(+e.target.value)}>
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
              <label>Month</label>
              <select value={mMonth} onChange={(e) => setMMonth(+e.target.value)}>
                {months.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            {monthly && (
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      {monthly.branches.map((b) => (
                        <th key={b}>{b}</th>
                      ))}
                      <th>Total Taken</th>
                      <th>Total Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.matrix.map((row) => (
                      <tr key={row.item}>
                        <td>
                          <b>{row.item}</b>
                        </td>
                        {monthly.branches.map((b) => (
                          <td key={b}>{row.byBranch[b] || ''}</td>
                        ))}
                        <td>
                          <b>{row.totalTaken}</b>
                        </td>
                        <td>{row.totalAdded || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'ranking' && (
          <div className="card">
            <h2>Branch Ranking</h2>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Branch</th>
                    <th>Total Taken</th>
                    <th>Total Added</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => (
                    <tr key={r.branch}>
                      <td>
                        <b>{r.rank}</b>
                      </td>
                      <td>{r.branch}</td>
                      <td>
                        <b>{r.taken}</b>
                      </td>
                      <td>{r.added}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'category' && (
          <div className="card">
            <h2>By Category</h2>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Items</th>
                    <th>Starting</th>
                    <th>Current</th>
                    <th>Low / Out</th>
                  </tr>
                </thead>
                <tbody>
                  {byCat.map((c) => (
                    <tr key={c.category}>
                      <td>
                        <span className="cat-tag">{c.category}</span>
                      </td>
                      <td>{c.items}</td>
                      <td>{c.starting}</td>
                      <td>
                        <b>{c.current}</b>
                      </td>
                      <td>{c.lowOut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'lists' && (
          <>
            <div className="card">
              <h2>Branches</h2>
              {isAdmin && (
                <button className="btn btn-green" onClick={addBranch}>
                  Add Branch
                </button>
              )}
              {!isAdmin && <p className="hint">View-only. Only admin can add branches.</p>}
              <div className="row-actions" style={{ marginTop: 12 }}>
                {branches.map((b) => (
                  <span key={b.id} className="cat-tag" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                    {b.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="card">
              <h2>Items</h2>
              {isAdmin && (
                <button className="btn btn-green" onClick={addItem}>
                  Add Item
                </button>
              )}
              {!isAdmin && <p className="hint">View-only. Only admin can add items.</p>}
              <div className="scroll" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Item</th>
                      <th>Starting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <span className="cat-tag">{i.category}</span>
                        </td>
                        <td>
                          <b>{i.name}</b>
                        </td>
                        <td>{i.starting}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'users' && (
          <UsersAdmin
            showToast={showToast}
            isAdmin={isAdmin}
            currentUserId={user.id}
            onSelfUpdated={(u) => {
              setUser(u);
              setUserState(u);
            }}
          />
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
