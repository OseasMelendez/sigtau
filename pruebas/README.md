# Pruebas funcionales automatizadas de la API

Pruebas de caja negra sobre la API REST: casos CP-01 a CP-05 del documento de pruebas,
control de acceso por rol y reglas de negocio de los disparadores.

## Cómo ejecutarlas
1. Crear una base aparte (p. ej. `sigtau_pruebas`) y cargar `database/SIGTAU_BD.sql`
   (las pruebas usan los datos de prueba del script y deben correr sobre una base recién cargada).
2. Levantar el backend apuntando a esa base, por ejemplo en el puerto 3100:
   ```
   cd backend && npm run build
   set DATABASE_URL=postgresql://postgres:CLAVE@localhost:5432/sigtau_pruebas?schema=sigtau
   set PORT=3100
   node dist/main.js
   ```
3. En otra terminal: `node pruebas/pruebas_api.mjs http://localhost:3100/api resultados.json`

## Última ejecución
20/11/2026 · 37 casos · **37 pasan** · ver `resultados_2026-11-20.json`.
