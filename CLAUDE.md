# SIGTAU — contexto para Claude Code

Sistema Integral de Gestión de Tutorías Académicas Universitarias. Proyecto final de
Análisis y Diseño de Software II (UES-FMO, Ciclo II/2026), Equipo 3.
**Entrega: viernes 20/11/2026, 11:55 pm.** Prioridad absoluta: que el sistema funcione en la
demo (conexión a BD, CRUD, validaciones, control de acceso por rol). Todo en español.

## Stack (fijado en el documento de avance, no cambiar)
- `frontend/`: React 19 + TypeScript + Vite + React Router + Tailwind v4 + lucide-react
- `backend/`: NestJS 11 + Prisma 6 (adaptador `@prisma/adapter-pg`, `engineType = "client"`)
- `database/SIGTAU_BD.sql`: PostgreSQL 16/17, esquema `sigtau`, 15 tablas, 5 disparadores, datos de prueba

## Comandos
```
# backend (http://localhost:3000/api)
cd backend && npm run start:dev
# frontend (http://localhost:5173, /api se redirige al backend)
cd frontend && npm run dev
# reiniciar la BD con los datos de prueba (borra y recrea el esquema)
psql -U postgres -d sigtau -f database/SIGTAU_BD.sql
```
Usuarios de prueba (contraseña `Sigtau2026!` para todos):
coordinador `rsilva` · tutores `rmendez`, `jsiron`, `eruiz`, `cperaza`, `asilva` ·
estudiantes `ga22001` (Ana García), `pe22002`, `go22003`, `ru22004` · `me22005` está desactivada.
También se puede entrar con el correo, p. ej. `ga22001@ues.edu.sv`.

## Reglas del proyecto
1. **La BD es la fuente de verdad.** NUNCA usar `prisma migrate` ni `prisma db push`
   (borrarían los disparadores). Si cambia la BD: `npx prisma db pull && npx prisma generate`.
2. **Las reglas de negocio ya están en los disparadores** (ver abajo). El backend NO las
   duplica: hace el insert/update y deja que `DbErrorFilter` (`backend/src/common/db-error.filter.ts`)
   convierta el `RAISE EXCEPTION` en un 400 con el mensaje. Sí valida formato con class-validator.
3. **Fechas:** columnas sin zona horaria en hora de El Salvador. En el backend usar `ahora()`
   y los helpers de `common/fecha.util.ts` (nunca `new Date()` para guardar). En el frontend usar
   `src/lib/fechas.ts` (formatea con `timeZone: 'UTC'`). TIME llega como `1970-01-01T09:00:00.000Z`.
4. **Seguridad:** guard JWT global (toda ruta exige sesión; `@Publica()` para excepciones) +
   `@Roles('Tutor')` por ruta. Usuario actual con `@Usuario() u: UsuarioActual`. El estudiante/tutor
   solo ve y modifica SUS datos: filtrar siempre por `u.id_usuario` en el servicio.
5. **Errores al usuario:** `ApiError.message` en el frontend ya trae el texto listo para mostrar.
6. Un módulo Nest por módulo del sistema: `src/<modulo>/{modulo.module,controller,service}.ts` + `dto/`.
   Registrarlo en `app.module.ts`.
7. Los usuarios, notificaciones y reportes NO se eliminan (disparador). Usuarios: `activo = false`.
8. Mensajes exactos que el documento de pruebas dice que muestra el sistema (respetarlos):
   - CP-01 login fallido: «Credenciales incorrectas» (ya implementado)
   - CP-02 dificultad vacía: «La dificultad es obligatoria»
   - CP-04 cancelar sin motivo: botón Confirmar deshabilitado + «Indica el motivo para continuar»
   - CP-05 seguimiento de tutoría futura: botón deshabilitado + «Solo se puede registrar seguimiento de tutorías ya realizadas»
   - CP-03: el modal Aprobar muestra el horario en solo lectura, pide solo el lugar, sin modalidad ni enlace virtual.

## Reglas en la BD (disparadores y restricciones)
- `validar_solicitud` (INSERT solicitud): franja no Ocupada; el tutor de la franja imparte la
  asignatura; sin otra solicitud Pendiente del mismo estudiante + tutor + asignatura.
- `gestionar_tutoria`: INSERT solo si la solicitud está Aprobada y con el mismo `id_horario` →
  franja pasa a Ocupado. UPDATE a Cancelada (exige motivo + fecha_cancelacion) → franja Disponible.
  Cambio de id_horario → la nueva debe estar Disponible. Tutoría Realizada/Cancelada no se modifica.
- `gestionar_reprogramacion`: propuesta = franja Disponible del mismo tutor, tutoría Programada,
  una pendiente por tutoría. Al pasar a Aceptada cambia el horario de la tutoría.
- `registrar_seguimiento`: tutoría Programada cuya fecha ya pasó → pasa a Realizada.
  Si `asistio`, `nivel_progreso` (Bajo/Medio/Avanzado) es obligatorio; observaciones obligatorias.
- Franjas: `hora_fin > hora_inicio` y sin solapamiento por tutor (EXCLUDE).
- Una sola sesión abierta por usuario (el login cierra la anterior).

## Flujo de aprobación (RF-04/RF-07), en UNA transacción
```ts
await prisma.$transaction(async (tx) => {
  await tx.solicitud_tutoria.update({ where: { id_solicitud }, data: { estado: 'Aprobada', fecha_respuesta: ahora() } });
  await tx.tutoria.create({ data: { id_solicitud, id_horario: solicitud.id_horario, lugar, fecha_programacion: ahora() } });
  await tx.notificacion.create({ data: { id_usuario: solicitud.id_estudiante, tipo: 'Tutoría', titulo: 'Tutoría programada', mensaje: '...' } });
});
```
Rechazar: `estado 'Rechazada'`, `motivo_rechazo` opcional, `fecha_respuesta: ahora()` (CHECK lo exige).

## Estado y plan (marcar al terminar)
**El frontend está COMPLETO** (todas las pantallas de los 3 roles, probadas con datos simulados).
Falta el backend: implementar los endpoints de **`API.md`** respetando los tipos de
`frontend/src/types.ts`. No cambies el frontend salvo para corregir un error real; si un dato
no encaja, ajusta el backend al contrato.

- [x] M1 Autenticación: login/logout/me, sesión en tabla `sesion`, bloqueo tras 5 intentos, roles
- [x] Frontend completo (`frontend/src/pages/`), cliente de API en `frontend/src/services.ts`
- [ ] Catálogos y tutores (`/asignaturas`, `/catalogos`, `/tutores...`)
- [ ] M3 Horarios
- [ ] M2 Solicitudes (crear, mías, pendientes, aprobar, rechazar)
- [ ] M4/M5 Tutorías (listar, detalle, cancelar, reprogramar, seguimiento, responder reprogramación)
- [ ] M6 Notificaciones (+ crearlas en cada evento 🔔 de API.md)
- [ ] M8 Usuarios
- [ ] M7 Reportes (métricas, vista previa, PDF/XLSX, historial)
- [ ] Probar los 5 casos (CP-01 a CP-05) en el navegador de punta a punta
- [ ] Pruebas Jest/Supertest mínimas — opcional si no hay tiempo

Orden recomendado: catálogos → horarios → solicitudes → tutorías → notificaciones → usuarios → reportes.
Después de cada módulo: `npm run build` en backend y probar la pantalla correspondiente.

## Frontend (referencia)
- Componentes base en `src/components/ui.tsx` (Boton, Badge, Tarjeta, Modal, Campo, Alerta, Vacio…),
  avisos con `useToast()`, carga de datos con `useCarga()` de `src/lib/hooks.ts`.
- Pantallas: `src/pages/estudiante/`, `src/pages/tutor/`, `src/pages/coordinador/`,
  `src/pages/DetalleTutoriaPage.tsx` (compartida), panel de notificaciones en `components/`.
- El diseño de *Detalles de Sesión* del Figma mostraba "modalidad virtual / enlace"; se reemplazó
  por **Lugar** porque el sistema es solo presencial (CP-03) y la BD no tiene esos campos.
- El plan Starter de Figma limita las llamadas del MCP por día: ya no hace falta consultarlo para el backend.

## Diseño (Figma)
Archivo `QnIABtYNHVoNFVokbCm55Q` ("SIGTAU-ADS"). Usar el MCP de Figma (`get_screenshot` /
`get_design_context`) con estos nodos. Colores ya definidos como tokens en `frontend/src/index.css`
(`bg-primario`, `text-primario-oscuro`, `bg-primario-suave`, `border-borde`, `bg-login`...).
Fotos de los diseños → usar `<Iniciales />` de `components/Layout.tsx`.

| Rol | Pantalla | Nodo |
|---|---|---|
| Todos | Login (mismo para los 3 roles) | 76:300 |
| Estudiante | Vista de Inicio | 1:5 |
| Estudiante | Nueva Solicitud | 1:179 |
| Estudiante | Detalle Tutor | 50:359 |
| Estudiante | Tutorías (Mis solicitudes) | 8:2 |
| Estudiante | Detalles de Sesión | 65:1362 |
| Estudiante | Historial de Tutorías | 3:333 |
| Estudiante | Notificaciones | 75:172 |
| Estudiante | Modal Confirmación de Reprogramación | 87:1932 |
| Tutor | Solicitudes Pendientes | 25:58 |
| Tutor | Tutorías Programadas | 26:330 |
| Tutor | Modal Reprogramar Tutoría | 87:2303 |
| Tutor | Modal Cancelar Tutoría | 87:2668 |
| Tutor | Administración de disponibilidad | 82:804 |
| Tutor | Programación de Tutorías (+ modal) | 276:248 / 276:4 |
| Tutor | Notificaciones | 88:3254 |
| Coordinador | Inicio / Métricas | 99:695 |
| Coordinador | Usuarios del Sistema | 91:5 |
| Coordinador | Modal Registrar Estudiante / Tutor | 102:1093 / 128:285 |
| Coordinador | Editar Estudiante / Tutor | 162:782 / 162:586 |
| Coordinador | Generar Reporte | 96:366 |
| Coordinador | Notificaciones | 162:2062 |
