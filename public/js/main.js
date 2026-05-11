const map = L.map('map', { zoomControl: true }).setView([40.7128, -74.006], 11);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 20,
  attribution:
    '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

const markers = L.markerClusterGroup();
map.addLayer(markers);

const state = {
  locations: [],
  markerById: new Map(),
  selectedId: null,
  center: null,
  listHidden: false,
  hasInitializedView: false
};

const listEl = document.getElementById('locationList');
const resultCountEl = document.getElementById('resultCount');
const mobileToggle = document.getElementById('mobileToggle');
const layout = document.getElementById('layout');

const filters = {
  q: document.getElementById('q'),
  city: document.getElementById('city'),
  postal: document.getElementById('postal'),
  category: document.getElementById('category'),
  radius: document.getElementById('radius')
};

function popupHtml(location) {
  return `
    <h3 class="popup-title">${escapeHtml(location.store_name)}</h3>
    <p class="popup-sub">${escapeHtml(location.address)}</p>
    <p class="popup-sub">Hours: ${escapeHtml(location.opening_hours)}</p>
    ${location.contact ? `<p class="popup-sub">Contact: ${escapeHtml(location.contact)}</p>` : ''}
    <a class="popup-link" href="${location.google_maps_link}" target="_blank" rel="noopener noreferrer">Get Directions</a>
  `;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderList() {
  listEl.innerHTML = '';
  resultCountEl.textContent = `${state.locations.length} result${state.locations.length === 1 ? '' : 's'}`;

  state.locations.forEach((location) => {
    const li = document.createElement('li');
    li.className = 'location-item';
    if (state.selectedId === location.id) li.classList.add('active');

    li.innerHTML = `
      <span class="badge">${escapeHtml(location.category)}</span>
      <h3>${escapeHtml(location.store_name)}</h3>
      <p>${escapeHtml(location.address)}</p>
      <p>${escapeHtml(location.opening_hours)}</p>
    `;

    li.addEventListener('click', () => focusLocation(location.id));
    listEl.appendChild(li);
  });
}

function renderMarkers() {
  markers.clearLayers();
  state.markerById.clear();

  state.locations.forEach((location) => {
    const marker = L.marker([location.latitude, location.longitude]);
    marker.bindPopup(popupHtml(location));
    marker.on('click', () => {
      state.selectedId = location.id;
      renderList();
    });

    markers.addLayer(marker);
    state.markerById.set(location.id, marker);
  });

  if (state.locations.length && !state.hasInitializedView) {
    const group = L.featureGroup([...state.markerById.values()]);
    map.fitBounds(group.getBounds().pad(0.2));
    state.hasInitializedView = true;
  }
}

function focusLocation(id) {
  const location = state.locations.find((loc) => loc.id === id);
  if (!location) return;

  state.selectedId = id;
  const marker = state.markerById.get(id);
  if (marker) {
    map.setView([location.latitude, location.longitude], 15, { animate: true });
    marker.openPopup();
  }
  renderList();
}

async function loadLocations() {
  const params = new URLSearchParams();
  if (filters.q.value.trim()) params.set('q', filters.q.value.trim());
  if (filters.city.value.trim()) params.set('city', filters.city.value.trim());
  if (filters.postal.value.trim()) params.set('postal', filters.postal.value.trim());
  if (filters.category.value) params.set('category', filters.category.value);

  const radius = filters.radius.value;
  if (radius) {
    params.set('radius', radius);

    const center = state.center || map.getCenter();
    params.set('lat', center.lat.toFixed(6));
    params.set('lng', center.lng.toFixed(6));
  }

  const bounds = map.getBounds();
  params.set('north', bounds.getNorth().toFixed(6));
  params.set('south', bounds.getSouth().toFixed(6));
  params.set('east', bounds.getEast().toFixed(6));
  params.set('west', bounds.getWest().toFixed(6));

  const response = await fetch(`/api/locations?${params.toString()}`);
  const payload = await response.json();
  state.locations = payload.data || [];

  renderMarkers();
  renderList();
}

let boundsLoadTimer;
map.on('moveend', () => {
  clearTimeout(boundsLoadTimer);
  boundsLoadTimer = setTimeout(() => loadLocations(), 250);
});

document.getElementById('applyFilters').addEventListener('click', () => {
  state.hasInitializedView = false;
  loadLocations();
});

document.getElementById('useMyLocation').addEventListener('click', () => {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      state.center = { lat: coords.latitude, lng: coords.longitude };
      map.setView([coords.latitude, coords.longitude], 13);
      state.hasInitializedView = false;
      loadLocations();
    },
    () => {
      loadLocations();
    }
  );
});

mobileToggle.addEventListener('click', () => {
  state.listHidden = !state.listHidden;
  layout.classList.toggle('list-hidden', state.listHidden);
  setTimeout(() => map.invalidateSize(), 120);
});

loadLocations();
