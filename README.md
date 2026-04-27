# Poco Cloud

Mini nube personal para alojar en un Xiaomi Poco F3 con Termux y publicar por internet mediante un VPS con Caddy + frp.

## Stack

- Backend: Fastify + TypeScript + SQLite
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Monorepo: pnpm workspaces
- Infra: Termux, Caddy, frp

## Desarrollo local

```bash
pnpm install
pnpm dev
```

API:

```bash
pnpm dev:api
```

Web:

```bash
pnpm dev:web
```

Primer usuario:

```bash
curl -X POST http://localhost:8080/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"santi\",\"password\":\"cambia-esta-clave\",\"displayName\":\"Santi\"}"
```

## Build

```bash
pnpm build
pnpm start
```

## Rutas principales

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /api/system/status`
- `GET /api/services`
- `POST /api/services/:name/start`
- `POST /api/services/:name/stop`
- `GET /api/logs/:service`
- `POST /api/files/list`
- `POST /api/files/upload`
- `POST /api/files/mkdir`
- `DELETE /api/files`

## Produccion en Termux

Ver [docs/DEPLOY.md](docs/DEPLOY.md).
