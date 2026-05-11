# Interactive Store Locator (Next.js Frontend + Node.js Backend)

Architecture:
- Frontend: Next.js + Tailwind (`frontend/`, port `3001`)
- Backend: Node.js + Express API (`server.js`, port `3000`)
- Database: PostgreSQL

## Run
1. Install backend deps:
```bash
npm install
```

2. Install frontend deps:
```bash
cd frontend && npm install
```

3. Configure backend env:
```bash
cp .env.example .env
```

4. Start PostgreSQL (Docker):
```bash
npm run db:up
```

5. Verify database connectivity:
```bash
npm run db:check
```

6. Configure frontend env:
```bash
cd frontend
cp .env.example .env.local
```

7. Start backend (terminal 1):
```bash
npm run dev
```

8. Start frontend (terminal 2):
```bash
npm run dev:frontend
```

9. Open:
- Frontend: `http://localhost:3001`
- Backend API: `http://localhost:3000`

## Backend Env (`.env`)
- `PORT=3000`
- `HOST=127.0.0.1`
- `SESSION_SECRET=replace-with-strong-secret`
- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=ChangeMe123!`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/store_locator`
- `DATABASE_SSL=false`
- `DB_CONNECT_RETRIES=10`
- `DB_CONNECT_DELAY_MS=1500`
- `GEOCODER_USER_AGENT=store-locator/1.0 (admin@example.com)`
- `COOKIE_SECURE=false`
- `FRONTEND_ORIGIN=http://localhost:3001`

## Frontend Env (`frontend/.env.local`)
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000`

## API Endpoints (Node.js Backend)
- `GET /api/locations`
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/session`
- `GET /api/admin/locations`
- `POST /api/admin/locations`
- `PUT /api/admin/locations/:id`
- `PATCH /api/admin/locations/:id/status`
- `DELETE /api/admin/locations/:id`

## Notes
- Backend uses PostgreSQL and auto-creates schema/tables on startup.
- Legacy Next API routes may still exist in `frontend/src/app/api`, but frontend is configured to use Node backend URL.
- Docker Compose is used to make local PostgreSQL reachable on `localhost:5432`.
