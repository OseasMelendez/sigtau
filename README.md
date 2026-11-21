# SIGTAU

Sistema Integral de Gestión de Tutorías Académicas Universitarias — Equipo 3,
Análisis y Diseño de Software II, UES-FMO, Ciclo II/2026.

React + Vite (frontend) · NestJS + Prisma (backend) · PostgreSQL (base de datos)

## Requisitos
- Node.js 20 o superior
- PostgreSQL 16 o 17 (con pgAdmin 4)

## Puesta en marcha (Windows)

### 1. Base de datos
En pgAdmin: crear la base `sigtau`, abrir el Query Tool sobre ella y ejecutar
`database/SIGTAU_BD.sql` (F5). Luego ejecutar también esta línea en el mismo Query Tool:

```sql
ALTER DATABASE sigtau SET timezone TO 'America/El_Salvador';
```

### 2. Backend
```
cd backend
copy .env.example .env
```
Editar `.env` y poner la contraseña de tu usuario `postgres` en `DATABASE_URL`. Después:
```
npm install
npm run start:dev
```
Debe aparecer `SIGTAU API en http://localhost:3000/api`.

### 3. Frontend (en otra terminal)
```
cd frontend
npm install
npm run dev
```
Abrir http://localhost:5173

> **¿Ya tenías la base de datos de antes?** Si después de un `git pull` el backend falla con
> `column ... does not exist` (p. ej. `titulo`, `area` o `foto`), vuelve a ejecutar
> `database/SIGTAU_BD.sql`: el script trae las columnas nuevas.

## Usuarios de prueba
Contraseña para todos: `Sigtau2026!`

| Rol | Usuario |
|---|---|
| Coordinador | `rsilva` |
| Tutor | `rmendez`, `jsiron`, `eruiz`, `cperaza`, `asilva` |
| Estudiante | `ga22001`, `pe22002`, `go22003`, `ru22004` |
| Estudiante desactivado | `me22005` (para demostrar el bloqueo) |

`ru22004` aún tiene la contraseña inicial: al entrar se abre **Mi perfil** pidiendo cambiarla.
Cada usuario cambia su foto y su contraseña con clic en su avatar o nombre del menú lateral.

## Archivos subidos
Las fotos de perfil y los documentos de apoyo de las solicitudes se guardan **en la base de datos**
(tabla `archivo`), así que no dependen del disco del servidor. Al reiniciar la base de datos con el
script se borran junto con los demás datos de prueba.

## Estructura
```
database/   script SQL (tablas, disparadores, datos de prueba)
backend/    API REST NestJS: un módulo por módulo del sistema (M1–M8)
frontend/   React: una página por pantalla del Figma
API.md      contrato de endpoints que el frontend espera del backend
```

## Problemas comunes
- **`password authentication failed`**: la contraseña de `DATABASE_URL` en `backend/.env` no es la de tu PostgreSQL.
- **`relation "usuario" does not exist`**: no se ejecutó el script en la base `sigtau`, o la URL no termina en `?schema=sigtau`.
- **El login responde «No se pudo conectar con el servidor»**: el backend no está corriendo.
- **`column ... does not exist`** (p. ej. `titulo`, `area`, `foto`): la base es de una versión anterior; volver a ejecutar `SIGTAU_BD.sql`.
- **Para dejar la BD como al inicio**: volver a ejecutar `SIGTAU_BD.sql` (borra y recrea todo). No hace falta reiniciar el backend ni ejecutar comandos de Prisma; solo volver a iniciar sesión.
