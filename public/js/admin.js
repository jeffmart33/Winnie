const loginPanel = document.getElementById('loginPanel');
const adminPanel = document.getElementById('adminPanel');
const logoutBtn = document.getElementById('logoutBtn');
const loginForm = document.getElementById('loginForm');
const locationForm = document.getElementById('locationForm');
const locationRows = document.getElementById('locationRows');
const formTitle = document.getElementById('formTitle');
const resetFormBtn = document.getElementById('resetFormBtn');

const state = {
  editingId: null,
  locations: []
};

function notify(message) {
  window.alert(message);
}

function setAuthenticated(authenticated) {
  loginPanel.classList.toggle('hidden', authenticated);
  adminPanel.classList.toggle('hidden', !authenticated);
  logoutBtn.classList.toggle('hidden', !authenticated);
}

async function checkSession() {
  const response = await fetch('/api/admin/session');
  const payload = await response.json();
  setAuthenticated(Boolean(payload.authenticated));
  if (payload.authenticated) await loadLocations();
}

async function loadLocations() {
  const response = await fetch('/api/admin/locations');
  const payload = await response.json();
  state.locations = payload.data || [];

  locationRows.innerHTML = '';
  state.locations.forEach((location) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${location.id}</td>
      <td>${escapeHtml(location.store_name)}</td>
      <td>${escapeHtml(location.category)}</td>
      <td>${escapeHtml(location.status)}</td>
      <td>${escapeHtml(location.address)}</td>
      <td>
        <div class="actions">
          <button data-id="${location.id}" data-action="edit">Edit</button>
          <button data-id="${location.id}" data-action="toggle">${location.status === 'active' ? 'Disable' : 'Enable'}</button>
          <button class="danger" data-id="${location.id}" data-action="delete">Delete</button>
        </div>
      </td>
    `;
    locationRows.appendChild(tr);
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resetForm() {
  state.editingId = null;
  formTitle.textContent = 'Add Location';
  locationForm.reset();
  locationForm.elements.status.value = 'active';
}

function fillForm(location) {
  state.editingId = location.id;
  formTitle.textContent = `Edit Location #${location.id}`;

  const fields = [
    'store_name',
    'category',
    'address',
    'latitude',
    'longitude',
    'google_maps_link',
    'opening_hours',
    'contact',
    'status'
  ];

  fields.forEach((field) => {
    if (locationForm.elements[field]) {
      locationForm.elements[field].value = location[field] ?? '';
    }
  });
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: formData.get('username'),
      password: formData.get('password')
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    notify(payload.error || 'Login failed');
    return;
  }

  loginForm.reset();
  setAuthenticated(true);
  await loadLocations();
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  setAuthenticated(false);
  resetForm();
});

locationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(locationForm);

  const payload = {
    store_name: formData.get('store_name'),
    category: formData.get('category'),
    address: formData.get('address'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
    google_maps_link: formData.get('google_maps_link'),
    opening_hours: formData.get('opening_hours'),
    contact: formData.get('contact'),
    status: formData.get('status')
  };

  const endpoint = state.editingId ? `/api/admin/locations/${state.editingId}` : '/api/admin/locations';
  const method = state.editingId ? 'PUT' : 'POST';

  const response = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    notify(data.error || 'Failed to save location');
    return;
  }

  resetForm();
  await loadLocations();
});

locationRows.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  const location = state.locations.find((item) => item.id === id);
  if (!location) return;

  if (action === 'edit') {
    fillForm(location);
    return;
  }

  if (action === 'toggle') {
    const response = await fetch(`/api/admin/locations/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: location.status === 'active' ? 'inactive' : 'active' })
    });

    if (!response.ok) notify('Failed to update status');
    await loadLocations();
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm(`Soft-delete location #${id}?`);
    if (!confirmed) return;

    const response = await fetch(`/api/admin/locations/${id}`, { method: 'DELETE' });
    if (!response.ok) notify('Failed to delete location');
    await loadLocations();
  }
});

resetFormBtn.addEventListener('click', resetForm);

checkSession();
