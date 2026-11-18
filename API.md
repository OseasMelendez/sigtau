# Contrato de la API de SIGTAU

El frontend ya está terminado y llama exactamente a estos endpoints (`frontend/src/services.ts`).
Las formas de las respuestas son los tipos de **`frontend/src/types.ts`**: el backend debe
devolver esos mismos campos con esos mismos nombres. Prefijo de todas las rutas: `/api`.

## Convenciones
- **Sesión:** cookie httpOnly (ya implementado en `AuthModule`). Toda ruta exige sesión. Usa
  `@Roles(...)` y `@Usuario() u: UsuarioActual`. El estudiante y el tutor **solo** ven y modifican
  lo suyo: filtra siempre por `u.id_usuario` y responde 404 si el recurso no es suyo.
- **Errores:** lanza `BadRequestException('mensaje para el usuario')`, `NotFoundException`, etc.
  El frontend muestra `message` tal cual. Los errores de los disparadores ya se traducen solos
  (`DbErrorFilter`), así que **no repitas sus validaciones**: haz el insert/update y deja que la BD decida.
- **Validación de entrada:** DTOs con class-validator y mensajes en español.
- **Franja** (`Franja` en types.ts): `fecha` como `'YYYY-MM-DD'` y horas como `'HH:mm'` (texto).
  Usa `textoFecha()` / `textoHora()` de `common/fecha.util.ts` para convertir, y
  `fechaDesdeTexto()` / `horaDesdeTexto()` para guardar.
- **Timestamps** (`fecha_solicitud`, `fecha_envio`, ...): devuélvelos como los da Prisma (Date → ISO).
- **"Ahora":** usa `ahora()`, nunca `new Date()`.
- **Notificaciones:** cada acción marcada con 🔔 crea una fila en `notificacion` para el destinatario,
  **dentro de la misma transacción**. Tipos válidos: Solicitud, Tutoría, Reprogramación, Cancelación,
  Recordatorio, Seguimiento, Usuario, Reporte, Sistema. `titulo` ≤ 100, `mensaje` ≤ 255 caracteres.

Conviene escribir funciones `mapFranja(h)`, `mapTutoria(t)` y `mapSolicitudEstudiante(s)` en un
archivo común (p. ej. `src/common/mapeos.ts`) y reutilizarlas en todos los servicios.

---

## Catálogos y tutores — `CatalogosModule` (cualquier rol)

| Método | Ruta | Respuesta | Notas |
|---|---|---|---|
| GET | `/asignaturas` | `Asignatura[]` | Solo `activa = true`, ordenadas por nombre |
| GET | `/catalogos` | `Catalogos` | Facultades, carreras y asignaturas activas |
| GET | `/tutores?asignatura=ID` | `TutorResumen[]` | Tutores **activos** que imparten la asignatura (`tutor_asignatura`). `franjas_disponibles` = franjas Disponibles con fecha ≥ hoy. `dias_disponibles` = días de la semana (1 = lun … 7 = dom) de esas franjas, sin repetir |
| GET | `/tutores/:id` | `TutorDetalle` | 404 si no existe o está inactivo |
| GET | `/tutores/:id/franjas?desde&hasta` | `Franja[]` | Franjas del tutor entre esas fechas (inclusive), Disponibles **y** Ocupadas, ordenadas por fecha y hora |

## M3 Horarios — `HorariosModule` (`@Roles('Tutor')`)

| Método | Ruta | Body | Respuesta | Notas |
|---|---|---|---|---|
| GET | `/horarios/mios?desde&hasta` | | `Franja[]` | Franjas del tutor en el rango |
| POST | `/horarios` | `{ fecha, hora_inicio, hora_fin }` | `Franja` | DTO: fecha `YYYY-MM-DD` ≥ hoy («La fecha no puede ser anterior a hoy»), horas `HH:mm`. El solapamiento y fin > inicio los valida la BD |
| PUT | `/horarios/:id` | igual | `Franja` | Solo si es suya, está Disponible y **no** tiene solicitudes Pendientes; si no: 400 «Solo puedes modificar franjas disponibles sin solicitudes pendientes» |
| DELETE | `/horarios/:id` | | 204 | Solo si es suya, está Disponible y no tiene **ninguna** solicitud ni tutoría asociada; si no: 400 «No se puede eliminar una franja que tiene solicitudes o tutorías asociadas» |

## M2 Solicitudes — `SolicitudesModule`

| Método | Ruta | Rol | Body | Respuesta |
|---|---|---|---|---|
| GET | `/solicitudes/mias` | Estudiante | | `SolicitudEstudiante[]` (más recientes primero) |
| POST | `/solicitudes` | Estudiante | `{ id_asignatura, id_horario, descripcion_dificultad }` | `SolicitudEstudiante` 🔔 al tutor |
| GET | `/solicitudes/pendientes` | Tutor | | `SolicitudTutor[]`: las Pendientes cuyas franjas son del tutor (más antiguas primero) |
| POST | `/solicitudes/:id/aprobar` | Tutor | `{ lugar }` | `{ id_tutoria }` 🔔 al estudiante |
| POST | `/solicitudes/:id/rechazar` | Tutor | `{ motivo_rechazo? }` | 204 🔔 al estudiante |

- `SolicitudEstudiante.tutor` = el tutor dueño de la franja (`horario_tutor.tutor`).
- `SolicitudEstudiante.tutoria` = la tutoría de la solicitud (o `null`), con su franja **vigente** y
  `reprogramacion_pendiente` (la de estado Pendiente, o `null`).
- DTO de creación: `descripcion_dificultad` obligatoria → **«La dificultad es obligatoria»** (CP-02);
  máx. 500 → «La dificultad no puede superar 500 caracteres».
- **Aprobar** (RF-04/RF-07): ver la transacción de ejemplo en `CLAUDE.md`. `lugar` obligatorio
  («Indica el lugar de la tutoría»), máx. 100. La solicitud debe ser del tutor y estar Pendiente
  (si no, 400 «La solicitud ya fue respondida»).
- **Rechazar:** `estado 'Rechazada'`, `fecha_respuesta: ahora()`, `motivo_rechazo` opcional (máx. 255).

## M4 / M5 Tutorías y seguimiento — `TutoriasModule`

| Método | Ruta | Rol | Body | Respuesta |
|---|---|---|---|---|
| GET | `/tutorias` | Estudiante o Tutor | | `Tutoria[]` del usuario (estudiante: `solicitud.id_estudiante`; tutor: `horario_tutor.id_tutor`) |
| GET | `/tutorias/:id` | Estudiante o Tutor | | `Tutoria` (404 si no participa en ella) |
| POST | `/tutorias/:id/cancelar` | Tutor | `{ motivo }` | 204 🔔 al estudiante |
| POST | `/tutorias/:id/reprogramar` | Tutor | `{ id_horario_propuesto, motivo }` | 204 🔔 al estudiante |
| POST | `/tutorias/:id/seguimiento` | Tutor | `{ asistio, nivel_progreso?, observaciones }` | 204 🔔 al estudiante |
| POST | `/reprogramaciones/:id/aceptar` | Estudiante | | 204 🔔 al tutor |
| POST | `/reprogramaciones/:id/rechazar` | Estudiante | | 204 🔔 al tutor |

- **Cancelar** (RF-13): `estado 'Cancelada'`, `motivo_cancelacion`, `fecha_cancelacion: ahora()`.
  Motivo obligatorio → «Indica el motivo para continuar» (CP-04). Si hay una reprogramación
  pendiente, márcala Rechazada en la misma transacción **antes** de cancelar.
- **Reprogramar** (RF-14): insertar en `reprogramacion` con `id_horario_anterior = tutoria.id_horario`.
  El disparador valida que la franja sea Disponible y del mismo tutor.
- **Seguimiento** (RF-08): insertar en `seguimiento`. El disparador rechaza tutorías futuras y cambia
  la tutoría a Realizada. Si `asistio` es `false`, guardar `nivel_progreso: null`.
  `observaciones` obligatorias → «Las observaciones son obligatorias».
- **Aceptar reprogramación:** `estado 'Aceptada'`, `fecha_respuesta: ahora()`. El disparador cambia el
  horario de la tutoría (libera la franja anterior y ocupa la nueva). Solo el estudiante de esa tutoría.
- **Rechazar reprogramación:** `estado 'Rechazada'`, `fecha_respuesta: ahora()`.

## M6 Notificaciones — `NotificacionesModule` (cualquier rol)

| Método | Ruta | Respuesta | Notas |
|---|---|---|---|
| GET | `/notificaciones` | `Notificacion[]` | Las del usuario, más recientes primero, máx. 50 |
| PATCH | `/notificaciones/:id/leida` | 204 | Solo si es suya |
| PATCH | `/notificaciones/leidas` | 204 | Marca todas como leídas |

Opcional (RF-10, si da tiempo): `@nestjs/schedule` con un `@Cron` cada hora que cree un
«Recordatorio» para el estudiante y el tutor de cada tutoría Programada que empiece en las próximas
24 h y aún no tenga recordatorio.

## M8 Usuarios — `UsuariosModule` (`@Roles('Coordinador')`)

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/usuarios?rol&q&activo` | | `UsuarioAdmin[]`, ordenados por nombre. `q` busca (sin distinguir mayúsculas) en nombre_completo, nombre_usuario, correo e identificación |
| POST | `/usuarios` | `DatosUsuario` (en services.ts) | `UsuarioAdmin` |
| PUT | `/usuarios/:id` | `DatosUsuario` | `UsuarioAdmin` |
| PATCH | `/usuarios/:id/activo` | `{ activo }` | 204 |

- Crear: solo roles Estudiante o Tutor. `contrasena` obligatoria (mín. 8), se guarda con
  `bcrypt.hash(c, 10)` (bcryptjs) y `debe_cambiar_contrasena: true`. En una transacción: `usuario`
  + `estudiante` (id_carrera, ciclo) o `tutor` (id_facultad, especialidad, telefono, biografia)
  + filas de `tutor_asignatura`. Los duplicados de usuario/correo/identificación ya devuelven 409
  con un mensaje legible.
- Editar: igual, sin cambiar el rol. Contraseña solo si viene. Para las asignaturas del tutor:
  `deleteMany` + `createMany` en `tutor_asignatura`.
- Activo: un coordinador no puede desactivarse a sí mismo (400). Al desactivar, cerrar sus
  sesiones abiertas (`fecha_cierre: ahora()`).

## M7 Reportes — `ReportesModule` (`@Roles('Coordinador')`)

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/reportes/metricas` | | `Metricas` |
| GET | `/reportes` | | `ReporteGenerado[]` (historial de **todos** los coordinadores, más recientes primero, máx. 20) |
| POST | `/reportes/vista-previa` | `FiltrosReporte` | `VistaPreviaReporte` |
| POST | `/reportes` | `FiltrosReporte & { formato: 'PDF' \| 'XLSX' }` | **Archivo** + registro en `reporte` 🔔 al coordinador |
| GET | `/reportes/:id/archivo` | | **Archivo** regenerado con los filtros y formato guardados en esa fila (no crea otro registro) |

- `Metricas`: `sesiones_activas` = sesiones sin `fecha_cierre` y no expiradas; `tasa_asistencia` =
  % de seguimientos con `asistio = true` (entero, 0 si no hay); `demanda_por_asignatura` = número de
  solicitudes por asignatura, de mayor a menor.
- Filtros: las tutorías se filtran por `horario_tutor.fecha` entre `fecha_desde` y `fecha_hasta`, y
  opcionalmente por tutor, asignatura y estado. Columnas sugeridas por tipo:
  - **Tutorías realizadas:** Fecha, Hora, Estudiante, Tutor, Asignatura, Lugar, Estado
  - **Asistencia estudiantil:** Estudiante, Carnet, Tutorías con seguimiento, Asistencias, Inasistencias, % asistencia
  - **Progreso académico:** Fecha, Estudiante, Asignatura, Tutor, Nivel, Observaciones
  - **Demanda por asignatura:** Asignatura, Solicitudes, Aprobadas, Rechazadas, Pendientes, Tutorías realizadas
  - **Gestión de solicitudes:** Fecha solicitud, Estudiante, Asignatura, Tutor, Estado, Fecha respuesta, Motivo rechazo
  `total_tutorias` = tutorías que cumplen los filtros; `tasa_asistencia` = % de esas tutorías con
  seguimiento en las que `asistio = true` (entero 0–100, 0 si no hay). Se muestran en las dos tarjetas.
- `ReporteGenerado`: además de las columnas de `reporte`, incluir `tutor` y `asignatura` (nombres,
  o `null`) y `responsable` (nombre del coordinador). Fechas DATE como `'YYYY-MM-DD'`.
- Archivo: reutiliza la misma función que la vista previa. PDF con `pdfkit` (título, rango, resumen,
  tabla), XLSX con `exceljs` (encabezado en negrita, columnas autoajustadas). Responder con
  `@Res()` usando `Content-Type` adecuado y
  `Content-Disposition: attachment; filename="reporte-<tipo>-<fecha>.pdf"`.
  Guardar la fila en `reporte` con `id_coordinador = u.id_usuario`.
