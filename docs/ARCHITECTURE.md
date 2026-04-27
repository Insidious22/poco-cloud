# Architecture

Poco Cloud usa el Poco F3 como servidor principal. El VPS no aloja datos de usuario ni logica de negocio; solo termina HTTPS con Caddy y reenvia hacia el tunel frp.

```text
Internet
  -> Caddy VPS :443
  -> frp tcp tunnel
  -> Termux localhost:8080
  -> Fastify API + React static app
  -> SQLite + archivos locales
```

## Monorepo

```text
apps/api       Fastify, SQLite, auth, controladores
apps/web       React, Vite, Tailwind
packages/shared Tipos y validaciones comunes
infra          Scripts y ejemplos para Termux, Caddy y frp
data           SQLite en produccion
docs           Documentacion operativa
```

## Seguridad

- El cliente web nunca envia comandos arbitrarios.
- La gestion de servicios usa una lista cerrada de nombres permitidos.
- Los comandos se ejecutan con `execFile` o `spawn`, sin shell ni interpolacion libre.
- Las rutas privadas usan JWT y validacion de sesion en SQLite.
- El gestor de archivos limita operaciones a `FILES_ROOT`.
- Caddy concentra HTTPS y el VPS solo expone `80`, `443` y `7000`.

## Datos

SQLite contiene:

- `users`: usuarios locales.
- `sessions`: sesiones activas con `jti`.
- `services_config`: configuracion futura de servicios permitidos.

## OAuth futuro

La autenticacion esta aislada en `apps/api/src/auth`. Para agregar OAuth, se puede crear un proveedor que termine en la misma emision de sesion JWT y reutilice `sessions`.
