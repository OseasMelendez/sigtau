# Pendientes del Figma que la BD no soporta

Elementos que aparecen en las vistas del Figma y que se dejaron fuera al ajustar el diseño
porque la base de datos no tiene dónde guardarlos. Se implementan al terminar de ajustar todas
las pantallas (cambio en BD → `npx prisma db pull && npx prisma generate` → backend → frontend).

| # | Elemento | Dónde aparece (pantalla / nodo Figma) | Qué haría falta |
|---|---|---|---|
| 1 | ✅ **Título profesional del tutor** | Inicio estudiante (1:5), Nueva Solicitud (1:179) | **Hecho:** columna `tutor.titulo`, se antepone al nombre en las pantallas del estudiante (`lib/nombres.ts`) y se edita en Registrar/Editar Tutor |
| 2 | ✅ **Foto de perfil** | Menú lateral, cabecera, Inicio (1:5), Nueva Solicitud (1:179) | **Hecho:** columna `usuario.foto`, imágenes PNG/JPG/WEBP hasta 2 MB en `backend/uploads/fotos`. Cada usuario cambia la suya con clic en su avatar del menú; el coordinador, desde Registrar/Editar. Sin foto se ven las iniciales |
| 3 | ✅ **Documento de apoyo** (opcional) en la solicitud | Nueva Solicitud (1:179) | **Hecho:** sin cambiar la BD (columna `documento_apoyo`). `POST/GET /solicitudes/:id/documento`, PDF/Word/imagen hasta 5 MB en `backend/uploads/` (fuera de git). Enlace "Ver documento de apoyo" para el estudiante, el tutor y en Detalles de Sesión |
| 4 | ❌ **Enlace "Ver todos"** junto a "Seleccionar Tutor Disponible" | Nueva Solicitud (1:179) | **Descartado:** ya se listan todos los tutores de la asignatura elegida |
| 5 | ❌ **Buscador "Buscar…" en la cabecera** | Mis Solicitudes (8:2), Modal Reprogramación (87:1932) | **Descartado:** las listas ya tienen filtros |
| 6 | ✅ **Área de la asignatura** | Historial (3:333) | **Hecho:** columna `asignatura.area`, etiqueta en el detalle del Historial |
| 7 | ✅ **Departamento del tutor** | Historial (3:333) | **Hecho:** columna `tutor.departamento`, en Historial, Detalle del Tutor y Detalles de Sesión; se edita en Registrar/Editar Tutor |
| 8 | ✅ **Estado "Reprogramada"** | Historial (3:333) | **Hecho:** `Tutoria.reprogramada` (hay una reprogramación Aceptada) y etiqueta en el Historial |
| 9 | ✅ **Participación por Facultad** | Inicio coordinador (99:695) | **Hecho como "Participación por Carrera"** (la BD tiene una sola facultad): `participacion_por_carrera` en `GET /reportes/metricas` |
| 10 | ❌ **Registro de Actividad** completo + "Ver todo el historial" | Inicio coordinador (99:695) | **Descartado** (no es requisito funcional y tocaba todos los módulos). Se queda la tarjeta con las últimas notificaciones del coordinador |

## Agregado fuera del Figma
- ✅ **Mi perfil** (clic en el avatar o el nombre del menú, o en el avatar de la cabecera): foto de perfil, datos de la cuenta y **cambio de contraseña** (`POST /perfil/contrasena`). Si el usuario aún tiene la contraseña inicial (`debe_cambiar_contrasena`), se abre solo una vez por sesión con un aviso (p. ej. `ru22004`). No es obligatorio: el usuario puede cerrarlo.

## Incoherencias del Figma (corregidas o por decidir)
| Pantalla | Problema en el diseño | Qué se hizo |
|---|---|---|
| Mis Tutorías (26:330) | Título "Tutorías Programadas y Realizadas", pero también lista Canceladas | Título cambiado a "Tutorías y Seguimiento" |
| Historial (3:333) | Dice "sesiones pasadas", pero lista también tutorías Programadas futuras | Subtítulo: "Revisa el registro y detalle de tus sesiones." |
| Modal Reprogramar (87:2303) | Llama "Horario Cancelado" al horario actual (no está cancelado) | Se muestra como "Horario actual" (tachado) |
| Mis Solicitudes (8:2) | Título "Tutorías Dashboard": mezcla inglés y no coincide con el menú "Mis Solicitudes" | Título cambiado a "Mis Solicitudes" |
| Varias | Título del tutor inconsistente: "Ing. Jonathan Sirón" en un lado, "Prof. Jonathan Sirón" en otro | Se usa el título guardado en la BD (`tutor.titulo`), el mismo en todas las pantallas |
| Varias | Mayúsculas inconsistentes ("No Asistió", "Limpiar Filtros", "Reprogramación Pendiente" vs. "Tutor asignado") | Se respetó el Figma; en español lo correcto es solo la primera mayúscula |
| Detalle de tutoría (tutor) | El Figma no tiene la vista de detalle para el tutor (solo la del estudiante, 65:1362) | Se reutiliza la misma página y se agregaron Reprogramar / Cancelar / Registrar seguimiento |
| Detalles de Sesión (65:1362) | La etiqueta "Programada" sale en verde, pero en el resto del Figma es morada | Se dejó morada en todo el sistema |
| Inicio coordinador (99:695) | Dice "Bienvenido, Administrador" y el menú "Portal Administrador", pero el rol en la BD y en los documentos es Coordinador | Saludo: "Bienvenido, Coordinador". Menú: "Portal Coordinador" |
| Inicio coordinador (99:695) | "Sesiones activas hoy" | Se muestran las sesiones abiertas **ahora** (dato real de la tabla `sesion`), con ese texto |
| Generar Reporte (96:366) | El tipo "Tutorías realizadas" junto al filtro Estado se contradice (se podía pedir "Tutorías realizadas" con estado "Canceladas"); y el Estado no afectaba a los otros 4 tipos | El Estado solo se habilita en ese tipo ("No aplica" en los demás), se describe qué trae cada tipo y la tabla se muestra abierta. **Opcional:** renombrar el tipo a "Listado de tutorías" (requiere cambiar el CHECK de `reporte.tipo` en la BD, el DTO del backend y `types.ts`) |
| Programación (276:248) | Los bloques "Por confirmar" llevan candado, aunque son los únicos que se pueden pulsar | Se respetó el Figma; se aclara con la leyenda "clic para aprobar" |

## Descartado (decisión del equipo, error del diseño)
- **Modalidad virtual / enlace de reunión** (Detalles de Sesión 65:1362): no se hará. El sistema es
  solo presencial y CP-03 exige que el modal Aprobar no pida modalidad ni enlace.
