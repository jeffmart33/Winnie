'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { LocationRecord } from '@/lib/types';

type SessionPayload = { authenticated: boolean; username?: string };

type LocationInput = {
  store_name: string;
  category: string;
  address: string;
  latitude: string;
  longitude: string;
  google_maps_link: string;
  opening_hours: string;
  contact: string;
  status: 'active' | 'inactive';
};

const initialForm: LocationInput = {
  store_name: '',
  category: 'Store',
  address: '',
  latitude: '',
  longitude: '',
  google_maps_link: '',
  opening_hours: '',
  contact: '',
  status: 'active'
};


export default function AdminClient() {

const [loggingIn, setLoggingIn] = useState(false);
const [saving, setSaving] = useState(false);
const [error, setError] = useState('');

  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [form, setForm] = useState<LocationInput>(initialForm);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const formTitle = useMemo(() => (editingId ? `Edit Location #${editingId}` : 'Add Location'), [editingId]);

  async function loadSession() {
    const session = await api<SessionPayload>('/api/admin/session');
    setAuthenticated(session.authenticated);
  }

  async function loadLocations() {
    const payload = await api<{ data: LocationRecord[] }>('/api/admin/locations');
    setLocations(payload.data || []);
  }

  useEffect(() => {
    loadSession().catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    loadLocations().catch(() => setLocations([]));
  }, [authenticated]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (loggingIn) return;

  try {
    setError('');
    setLoggingIn(true);

    await api('/api/admin/login', 'POST', {
      username,
      password
    });

    setPassword('');
    setAuthenticated(true);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Login failed');
  } finally {
    setLoggingIn(false);
  }
}

  async function handleLogout() {
    await api('/api/admin/logout', 'POST');
    setAuthenticated(false);
    setEditingId(null);
    setForm(initialForm);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (saving) return;

  try {
    setError('');
    setSaving(true);

    const payload = {
      ...form,
      latitude: form.latitude.trim(),
      longitude: form.longitude.trim()
    };

    if (editingId) {
      await api(`/api/admin/locations/${editingId}`, 'PUT', payload);
    } else {
      await api('/api/admin/locations', 'POST', payload);
    }

    setEditingId(null);
    setForm(initialForm);
    await loadLocations();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Save failed');
  } finally {
    setSaving(false);
  }
}

  function startEdit(item: LocationRecord) {
    setEditingId(item.id);
    setForm({
      store_name: item.store_name,
      category: item.category,
      address: item.address,
      latitude: String(item.latitude),
      longitude: String(item.longitude),
      google_maps_link: item.google_maps_link || '',
      opening_hours: item.opening_hours,
      contact: item.contact || '',
      status: item.status
    });
  }

  async function toggleStatus(item: LocationRecord) {
    const next = item.status === 'active' ? 'inactive' : 'active';
    await api(`/api/admin/locations/${item.id}/status`, 'PATCH', { status: next });
    await loadLocations();
  }

  async function remove(item: LocationRecord) {
    const ok = window.confirm(`Soft-delete location #${item.id}?`);
    if (!ok) return;
    await api(`/api/admin/locations/${item.id}`, 'DELETE');
    await loadLocations();
  }

  return (
    <div className="mx-auto max-w-[1300px] p-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] text-mint">Administration</p>
          <h1 className="text-2xl font-semibold">Manage Locations</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="rounded-lg border border-line bg-panel px-3 py-2 text-sm hover:bg-panelAlt">View Locator</Link>
          {authenticated ? (
            <button className="rounded-lg border border-line bg-panel px-3 py-2 text-sm hover:bg-panelAlt" onClick={handleLogout}>Logout</button>
          ) : null}
        </div>
      </header>

      {!authenticated ? (
        <section className="max-w-md rounded-xl border border-line bg-panel/90 p-4">
          <h2 className="mb-3 text-lg font-semibold">Admin Login</h2>
          <form className="grid gap-2" onSubmit={handleLogin}>
            <input className="rounded-lg border border-line bg-panelAlt/40 p-2" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" required />
            <input className="rounded-lg border border-line bg-panelAlt/40 p-2" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
            <button
  disabled={loggingIn}
  className="rounded-lg bg-gradient-to-r from-mint to-emerald-400 p-2 font-semibold text-ink disabled:opacity-60"
>
  {loggingIn ? 'Logging in...' : 'Login'}
</button>
{error ? (
  <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">
    {error}
  </p>
) : null}
          </form>
        </section>
      ) : (
        <main className="grid gap-4 md:grid-cols-[380px_1fr]">
          <section className="rounded-xl border border-line bg-panel/90 p-4">
            <h2 className="mb-3 text-lg font-semibold">{formTitle}</h2>
            <form className="grid gap-2" onSubmit={handleSave}>
              <input className="rounded-lg border border-line bg-panelAlt/40 p-2" value={form.store_name} onChange={(e) => setForm((p) => ({ ...p, store_name: e.target.value }))} placeholder="Store Name" required />
              <select className="rounded-lg border border-line bg-panelAlt/40 p-2" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                <option value="Store">Store</option>
                <option value="Restaurant">Restaurant</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="Pop-Up">Pop-Up</option>
                <option value="Apparel">Apparel</option>
              </select>
              <input className="rounded-lg border border-line bg-panelAlt/40 p-2" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Full Address" />
              <div className="grid grid-cols-2 gap-2">
                <input className="rounded-lg border border-line bg-panelAlt/40 p-2" value={form.latitude} onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))} placeholder="Latitude" type="number" step="any" />
                <input className="rounded-lg border border-line bg-panelAlt/40 p-2" value={form.longitude} onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))} placeholder="Longitude" type="number" step="any" />
              </div>
              <input className="rounded-lg border border-line bg-panelAlt/40 p-2" value={form.google_maps_link} onChange={(e) => setForm((p) => ({ ...p, google_maps_link: e.target.value }))} placeholder="Google Maps link (optional)" />
              <input className="rounded-lg border border-line bg-panelAlt/40 p-2" value={form.opening_hours} onChange={(e) => setForm((p) => ({ ...p, opening_hours: e.target.value }))} placeholder="Opening Hours" required />
              <input className="rounded-lg border border-line bg-panelAlt/40 p-2" value={form.contact} onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))} placeholder="Contact info" />
              <select className="rounded-lg border border-line bg-panelAlt/40 p-2" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as 'active' | 'inactive' }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button
  disabled={saving}
  className="rounded-lg bg-gradient-to-r from-mint to-emerald-400 p-2 font-semibold text-ink disabled:opacity-60"
>
  {saving ? 'Saving...' : 'Save'}
</button>
{error ? (
  <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">
    {error}
  </p>
) : null}
                <button
                  type="button"
                  className="rounded-lg border border-line bg-panelAlt/40 p-2"
                  onClick={() => {
                    setEditingId(null);
                    setForm(initialForm);
                  }}
                >
                  Reset
                </button>
                {error ? (
  <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">
    {error}
  </p>
) : null}
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-line bg-panel/90 p-4">
            <h2 className="mb-3 text-lg font-semibold">Location Records</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-slate-300">
                    <th className="p-2">ID</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Address</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((item) => (
                    <tr key={item.id} className="border-b border-line/60">
                      <td className="p-2">{item.id}</td>
                      <td className="p-2">{item.store_name}</td>
                      <td className="p-2">{item.category}</td>
                      <td className="p-2">{item.status}</td>
                      <td className="p-2">{item.address}</td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <button className="rounded border border-line px-2 py-1" onClick={() => startEdit(item)}>Edit</button>
                          <button className="rounded border border-line px-2 py-1" onClick={() => toggleStatus(item)}>{item.status === 'active' ? 'Disable' : 'Enable'}</button>
                          <button className="rounded border border-red-400/50 bg-red-500/10 px-2 py-1 text-red-200" onClick={() => remove(item)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
