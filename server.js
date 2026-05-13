require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const SQLiteStoreFactory = require('connect-sqlite3');
const { getDb } = require('./src/db');
const { geocodeAddress, reverseGeocode } = require('./src/geocode');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3001';

const SQLiteStore = SQLiteStoreFactory(session);
const sessionDir = path.join(__dirname, 'data');

if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: FRONTEND_ORIGIN.split(',').map((item) => item.trim()),
    credentials: true
  })
);

app.set('trust proxy', 1);

app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: path.join(__dirname, 'data') }),
    secret: process.env.SESSION_SECRET || 'replace-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
  httpOnly: true,
  sameSite: 'none',
  secure: true,
  maxAge: 1000 * 60 * 60 * 8
}
  })
);

app.use(express.static(path.join(__dirname, 'public')));

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.adminId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function normalizeLocationPayload(payload) {
  return {
    store_name: String(payload.store_name || '').trim(),
    category: String(payload.category || '').trim(),
    address: String(payload.address || '').trim(),
    latitude:
      payload.latitude === undefined || payload.latitude === null || payload.latitude === ''
        ? null
        : Number(payload.latitude),
    longitude:
      payload.longitude === undefined || payload.longitude === null || payload.longitude === ''
        ? null
        : Number(payload.longitude),
    opening_hours: String(payload.opening_hours || '').trim(),
    contact: String(payload.contact || '').trim() || null,
    google_maps_link: String(payload.google_maps_link || '').trim() || null,
    status: payload.status === 'inactive' ? 'inactive' : 'active'
  };
}

function validateRequired(location) {
  const requiredFields = ['store_name', 'category', 'opening_hours'];
  for (const field of requiredFields) {
    if (!location[field]) {
      return `${field} is required`;
    }
  }

  if (location.latitude !== null && Number.isNaN(location.latitude)) return 'latitude must be numeric';
  if (location.longitude !== null && Number.isNaN(location.longitude)) return 'longitude must be numeric';

  return null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function enrichLocationFromGeo(location) {
  const hasAddress = Boolean(location.address);
  const hasCoords = location.latitude !== null && location.longitude !== null;

  if (!hasAddress && !hasCoords) {
    throw new Error('Either address or latitude/longitude is required');
  }

  if (hasAddress && !hasCoords) {
    const result = await geocodeAddress(location.address);
    location.latitude = result.latitude;
    location.longitude = result.longitude;
    location.address = result.formattedAddress;
  }

  if (!hasAddress && hasCoords) {
    const result = await reverseGeocode(location.latitude, location.longitude);
    location.address = result.formattedAddress;
  }

  if (hasAddress && hasCoords && !location.google_maps_link) {
    location.google_maps_link = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  }

  if (!location.google_maps_link) {
    location.google_maps_link = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  }

  return location;
}

app.get('/api/locations', async (req, res) => {
  try {
    const db = await getDb();
    const q = String(req.query.q || '').trim().toLowerCase();
    const postal = String(req.query.postal || '').trim().toLowerCase();
    const city = String(req.query.city || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim();
    const radiusKm = req.query.radius ? Number(req.query.radius) : null;
    const centerLat = req.query.lat ? Number(req.query.lat) : null;
    const centerLng = req.query.lng ? Number(req.query.lng) : null;
    const north = req.query.north ? Number(req.query.north) : null;
    const south = req.query.south ? Number(req.query.south) : null;
    const east = req.query.east ? Number(req.query.east) : null;
    const west = req.query.west ? Number(req.query.west) : null;

    let sql = 'SELECT * FROM locations WHERE deleted_at IS NULL AND status = ?';
    const params = ['active'];

    if (q) {
      sql += ' AND (LOWER(store_name) LIKE ? OR LOWER(address) LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    if (postal) {
      sql += ' AND LOWER(address) LIKE ?';
      params.push(`%${postal}%`);
    }

    if (city) {
      sql += ' AND LOWER(address) LIKE ?';
      params.push(`%${city}%`);
    }

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (
      north !== null &&
      south !== null &&
      east !== null &&
      west !== null &&
      !Number.isNaN(north) &&
      !Number.isNaN(south) &&
      !Number.isNaN(east) &&
      !Number.isNaN(west)
    ) {
      sql += ' AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?';
      params.push(Math.min(south, north), Math.max(south, north), Math.min(west, east), Math.max(west, east));
    }

    sql += ' ORDER BY store_name ASC';

    let locations = await db.all(sql, params);

    if (
      radiusKm !== null &&
      !Number.isNaN(radiusKm) &&
      centerLat !== null &&
      centerLng !== null &&
      !Number.isNaN(centerLat) &&
      !Number.isNaN(centerLng)
    ) {
      locations = locations
        .map((loc) => ({
          ...loc,
          distance_km: haversineKm(centerLat, centerLng, loc.latitude, loc.longitude)
        }))
        .filter((loc) => loc.distance_km <= radiusKm)
        .sort((a, b) => a.distance_km - b.distance_km);
    }

    res.json({ data: locations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

app.post('/api/filter-applications', async (req, res) => {
  try {
    const payload = req.body || {};
    const query = String(payload.q || '').trim() || null;
    const city = String(payload.city || '').trim() || null;
    const postal = String(payload.postal || '').trim() || null;
    const category = String(payload.category || '').trim() || null;
    const radiusKm =
      payload.radius === undefined || payload.radius === null || payload.radius === ''
        ? null
        : Number(payload.radius);
    const centerLat =
      payload.centerLat === undefined || payload.centerLat === null || payload.centerLat === ''
        ? null
        : Number(payload.centerLat);
    const centerLng =
      payload.centerLng === undefined || payload.centerLng === null || payload.centerLng === ''
        ? null
        : Number(payload.centerLng);

    if (radiusKm !== null && Number.isNaN(radiusKm)) {
      return res.status(400).json({ error: 'radius must be numeric' });
    }
    if (centerLat !== null && Number.isNaN(centerLat)) {
      return res.status(400).json({ error: 'centerLat must be numeric' });
    }
    if (centerLng !== null && Number.isNaN(centerLng)) {
      return res.status(400).json({ error: 'centerLng must be numeric' });
    }

    const db = await getDb();
    const result = await db.run(
      `INSERT INTO filter_applications
      (query, city, postal, category, radius_km, center_lat, center_lng)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [query, city, postal, category, radiusKm, centerLat, centerLng]
    );

    const created = await db.get('SELECT * FROM filter_applications WHERE id = ?', [result.lastID]);
    res.status(201).json({ data: created });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store applied filters' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const db = await getDb();
    const admin = await db.get('SELECT * FROM admins WHERE username = ?', [username]);

    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.adminId = admin.id;
    req.session.adminUsername = admin.username;

    res.json({ ok: true, username: admin.username });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/admin/session', (req, res) => {
  if (!req.session || !req.session.adminId) {
    return res.json({ authenticated: false });
  }

  res.json({ authenticated: true, username: req.session.adminUsername });
});

app.get('/api/admin/locations', requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const showDeleted = req.query.showDeleted === 'true';

    let sql = 'SELECT * FROM locations';
    if (!showDeleted) sql += ' WHERE deleted_at IS NULL';
    sql += ' ORDER BY updated_at DESC';

    const locations = await db.all(sql);
    res.json({ data: locations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin locations' });
  }
});

app.post('/api/admin/locations', requireAdmin, async (req, res) => {
  try {
    let location = normalizeLocationPayload(req.body);
    const validationError = validateRequired(location);
    if (validationError) return res.status(400).json({ error: validationError });

    location = await enrichLocationFromGeo(location);

    const db = await getDb();
    const result = await db.run(
      `INSERT INTO locations
      (store_name, category, address, latitude, longitude, opening_hours, contact, google_maps_link, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        location.store_name,
        location.category,
        location.address,
        location.latitude,
        location.longitude,
        location.opening_hours,
        location.contact,
        location.google_maps_link,
        location.status
      ]
    );

    const created = await db.get('SELECT * FROM locations WHERE id = ?', [result.lastID]);
    res.status(201).json({ data: created });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to create location' });
  }
});

app.put('/api/admin/locations/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    let location = normalizeLocationPayload(req.body);
    const validationError = validateRequired(location);
    if (validationError) return res.status(400).json({ error: validationError });

    location = await enrichLocationFromGeo(location);

    const db = await getDb();
    const existing = await db.get('SELECT id FROM locations WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!existing) return res.status(404).json({ error: 'Location not found' });

    await db.run(
      `UPDATE locations SET
        store_name = ?,
        category = ?,
        address = ?,
        latitude = ?,
        longitude = ?,
        opening_hours = ?,
        contact = ?,
        google_maps_link = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        location.store_name,
        location.category,
        location.address,
        location.latitude,
        location.longitude,
        location.opening_hours,
        location.contact,
        location.google_maps_link,
        location.status,
        id
      ]
    );

    const updated = await db.get('SELECT * FROM locations WHERE id = ?', [id]);
    res.json({ data: updated });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update location' });
  }
});

app.patch('/api/admin/locations/:id/status', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body.status === 'inactive' ? 'inactive' : 'active';

    const db = await getDb();
    const existing = await db.get('SELECT id FROM locations WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!existing) return res.status(404).json({ error: 'Location not found' });

    await db.run('UPDATE locations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    const updated = await db.get('SELECT * FROM locations WHERE id = ?', [id]);
    res.json({ data: updated });
  } catch (error) {
    res.status(400).json({ error: 'Failed to update status' });
  }
});

app.delete('/api/admin/locations/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const db = await getDb();
    const existing = await db.get('SELECT id FROM locations WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!existing) return res.status(404).json({ error: 'Location not found' });

    await db.run(
      'UPDATE locations SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, HOST, async () => {
  await getDb();
  console.log(`Store locator running on http://${HOST}:${PORT}`);
});
