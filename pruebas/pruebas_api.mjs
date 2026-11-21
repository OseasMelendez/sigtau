// Pruebas funcionales automatizadas (caja negra) de la API de SIGTAU.
// Uso: node pruebas_api.mjs http://localhost:3100/api salida.json
// Requiere una BD recién cargada con database/SIGTAU_BD.sql (datos de prueba).
import fs from 'node:fs';

const API = process.argv[2] ?? 'http://localhost:3100/api';
const SALIDA = process.argv[3] ?? 'resultados.json';
const CLAVE = 'Sigtau2026!';
const resultados = [];

// ---------- cliente HTTP con cookie de sesión ----------
async function pedir(sesion, metodo, ruta, cuerpo, esForm) {
  const headers = {};
  if (sesion?.cookie) headers.Cookie = sesion.cookie;
  let body;
  if (esForm) body = cuerpo;
  else if (cuerpo !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(cuerpo); }
  const r = await fetch(API + ruta, { method: metodo, headers, body });
  const sc = r.headers.get('set-cookie');
  if (sc && sesion) sesion.cookie = sc.split(';')[0];
  const tipo = r.headers.get('content-type') ?? '';
  const datos = tipo.includes('json') ? await r.json().catch(() => null) : null;
  return { status: r.status, datos, tipo, setCookie: sc };
}
async function entrar(usuario, clave = CLAVE) {
  const s = { usuario };
  const r = await pedir(s, 'POST', '/auth/login', { usuario, contrasena: clave });
  return { s, r };
}

// ---------- registro de cada caso ----------
async function caso(id, modulo, descripcion, esperado, fn) {
  const t0 = Date.now();
  let ok = false, obtenido = '';
  try {
    const res = await fn();
    ok = res.ok; obtenido = res.obtenido;
  } catch (e) { obtenido = 'Excepción: ' + e.message; }
  resultados.push({ id, modulo, descripcion, esperado, obtenido, resultado: ok ? 'PASA' : 'FALLA', ms: Date.now() - t0 });
  console.log(`${ok ? 'PASA ' : 'FALLA'}  ${id}  ${descripcion}  →  ${obtenido}`);
}
const msg = (r) => `${r.status}${r.datos?.message ? ' «' + r.datos.message + '»' : ''}`;
const es = (r, status, texto) => ({ ok: r.status === status && (!texto || (r.datos?.message ?? '').includes(texto)), obtenido: msg(r) });

// Fechas futuras para las franjas de prueba
const hoy = new Date(Date.now() - 6 * 3600e3);
const dia = (n) => new Date(hoy.getTime() + n * 86400e3).toISOString().slice(0, 10);
const F1 = dia(10), F2 = dia(11), F3 = dia(12);

// ====================== M1 Autenticación y seguridad ======================
await caso('CP-01', 'M1 Autenticación', 'Login con contraseña incorrecta', '401 «Credenciales incorrectas»', async () => {
  const { r } = await entrar('rsilva', 'otra-clave'); return es(r, 401, 'Credenciales incorrectas');
});
await caso('PS-01', 'M1 Autenticación', 'Login correcto devuelve cookie httpOnly', '200 + cookie HttpOnly; SameSite=Strict', async () => {
  const { r } = await entrar('ga22001');
  const ok = r.status === 200 && /HttpOnly/i.test(r.setCookie ?? '') && /SameSite=Strict/i.test(r.setCookie ?? '');
  return { ok, obtenido: `${r.status} ${ok ? 'cookie HttpOnly; SameSite=Strict' : r.setCookie}` };
});
await caso('PS-02', 'M1 Autenticación', 'Usuario desactivado no puede entrar (me22005)', '403', async () => {
  const { r } = await entrar('me22005'); return es(r, 403);
});
await caso('PS-03', 'M1 Seguridad', 'Ruta protegida sin sesión', '401', async () => es(await pedir({}, 'GET', '/tutorias'), 401));

const est = (await entrar('ga22001')).s;      // Ana García
const est2 = (await entrar('pe22002')).s;     // Juan Pérez
const tut = (await entrar('jsiron')).s;       // Jonathan Sirón
const tut2 = (await entrar('rmendez')).s;     // Roberto Méndez
const coord = (await entrar('rsilva')).s;     // Coordinador

await caso('PS-04', 'M1 Seguridad', 'Estudiante intenta ver solicitudes pendientes del tutor', '403', async () =>
  es(await pedir(est, 'GET', '/solicitudes/pendientes'), 403));
await caso('PS-05', 'M1 Seguridad', 'Tutor intenta listar usuarios (solo coordinador)', '403', async () =>
  es(await pedir(tut, 'GET', '/usuarios'), 403));
await caso('PS-06', 'M1 Seguridad', 'Sesión única: al volver a entrar se invalida la sesión anterior', '401 con la cookie vieja', async () => {
  const vieja = (await entrar('go22003')).s;
  await entrar('go22003');
  return es(await pedir(vieja, 'GET', '/auth/me'), 401);
});

// ====================== M3 Horarios ======================
let f1, f2, f3;
await caso('PH-01', 'M3 Horarios', 'Tutor registra una franja futura', '201 + franja Disponible', async () => {
  const r = await pedir(tut, 'POST', '/horarios', { fecha: F1, hora_inicio: '10:00', hora_fin: '11:00' });
  f1 = r.datos?.id_horario;
  return { ok: r.status === 201 && r.datos?.estado === 'Disponible', obtenido: `${r.status} id=${f1} ${r.datos?.estado ?? msg(r)}` };
});
await caso('PH-02', 'M3 Horarios', 'Franja que se solapa con otra del mismo tutor', '400 (restricción EXCLUDE)', async () =>
  es(await pedir(tut, 'POST', '/horarios', { fecha: F1, hora_inicio: '10:30', hora_fin: '11:30' }), 400, 'solapa'));
await caso('PH-03', 'M3 Horarios', 'Hora de fin anterior a la de inicio', '400', async () =>
  es(await pedir(tut, 'POST', '/horarios', { fecha: F1, hora_inicio: '15:00', hora_fin: '14:00' }), 400));
await caso('PH-04', 'M3 Horarios', 'Franja con fecha pasada', '400 «La fecha no puede ser anterior a hoy»', async () =>
  es(await pedir(tut, 'POST', '/horarios', { fecha: '2026-01-10', hora_inicio: '08:00', hora_fin: '09:00' }), 400, 'anterior a hoy'));
f2 = (await pedir(tut, 'POST', '/horarios', { fecha: F2, hora_inicio: '10:00', hora_fin: '11:00' })).datos?.id_horario;
f3 = (await pedir(tut, 'POST', '/horarios', { fecha: F3, hora_inicio: '09:00', hora_fin: '10:00' })).datos?.id_horario;

// ====================== M2 Solicitudes ======================
let sol;
await caso('CP-02', 'M2 Solicitudes', 'Enviar solicitud sin describir la dificultad', '400 «La dificultad es obligatoria»', async () =>
  es(await pedir(est, 'POST', '/solicitudes', { id_asignatura: 1, id_horario: f1, descripcion_dificultad: '' }), 400, 'La dificultad es obligatoria'));
await caso('PSO-01', 'M2 Solicitudes', 'Estudiante envía solicitud válida', '201 + estado Pendiente', async () => {
  const r = await pedir(est, 'POST', '/solicitudes', { id_asignatura: 1, id_horario: f1, descripcion_dificultad: 'Prueba automatizada: derivadas implícitas.' });
  sol = r.datos?.id_solicitud;
  return { ok: r.status === 201 && r.datos?.estado === 'Pendiente', obtenido: `${r.status} id=${sol} ${r.datos?.estado ?? msg(r)}` };
});
await caso('PSO-02', 'M2 Solicitudes', 'El tutor recibe la notificación de la nueva solicitud', 'Notificación «Nueva solicitud de tutoría»', async () => {
  const r = await pedir(tut, 'GET', '/notificaciones');
  const ok = r.status === 200 && r.datos.some((n) => n.titulo === 'Nueva solicitud de tutoría');
  return { ok, obtenido: ok ? '200, notificación encontrada' : msg(r) };
});
await caso('PSO-03', 'M2 Solicitudes', 'Segunda solicitud pendiente al mismo tutor y asignatura', '400 (disparador validar_solicitud)', async () =>
  es(await pedir(est, 'POST', '/solicitudes', { id_asignatura: 1, id_horario: f3, descripcion_dificultad: 'Duplicada' }), 400, 'pendiente'));
await caso('PSO-04', 'M2 Solicitudes', 'Solicitud de una asignatura que el tutor no imparte', '400 (disparador validar_solicitud)', async () =>
  es(await pedir(est, 'POST', '/solicitudes', { id_asignatura: 3, id_horario: f3, descripcion_dificultad: 'Física con Sirón' }), 400, 'no imparte'));
await caso('PSO-05', 'M2 Solicitudes', 'Otro tutor intenta aprobar una solicitud que no es suya', '400 o 404', async () => {
  const r = await pedir(tut2, 'POST', `/solicitudes/${sol}/aprobar`, { lugar: 'Aula 1' });
  return { ok: r.status === 404 || r.status === 400, obtenido: msg(r) };
});
await caso('CP-03', 'M2 Solicitudes', 'Aprobar sin indicar el lugar (solo se pide el lugar)', '400 «Indica el lugar de la tutoría»', async () =>
  es(await pedir(tut, 'POST', `/solicitudes/${sol}/aprobar`, { lugar: '' }), 400, 'Indica el lugar'));
let tutoria;
await caso('PSO-06', 'M2/M4', 'Aprobar con lugar crea la tutoría y ocupa la franja', '200 + id_tutoria; franja Ocupado', async () => {
  const r = await pedir(tut, 'POST', `/solicitudes/${sol}/aprobar`, { lugar: 'Aula 21, Edificio de Ingeniería' });
  tutoria = r.datos?.id_tutoria;
  const t = await pedir(est, 'GET', `/tutorias/${tutoria}`);
  const fr = await pedir(tut, 'GET', `/horarios/mios?desde=${F1}&hasta=${F1}`);
  const ocupada = fr.datos?.find((f) => f.id_horario === f1)?.estado;
  return { ok: r.status === 200 && t.datos?.estado === 'Programada' && ocupada === 'Ocupado', obtenido: `${r.status} tutoría=${tutoria} ${t.datos?.estado}, franja ${ocupada}` };
});
await caso('PSO-07', 'M2 Solicitudes', 'Otro estudiante solicita la franja ya ocupada', '400 «La franja seleccionada está ocupada.»', async () =>
  es(await pedir(est2, 'POST', '/solicitudes', { id_asignatura: 1, id_horario: f1, descripcion_dificultad: 'Quiero esa hora' }), 400, 'ocupada'));

// ====================== M4 / M5 Tutorías, reprogramación y seguimiento ======================
await caso('CP-05', 'M5 Seguimiento', 'Registrar seguimiento de una tutoría futura', '400 (la sesión aún no ha ocurrido)', async () =>
  es(await pedir(tut, 'POST', `/tutorias/${tutoria}/seguimiento`, { asistio: true, nivel_progreso: 'Medio', observaciones: 'Antes de tiempo' }), 400));
await caso('PT-01', 'M5 Seguimiento', 'Asistió pero sin nivel de progreso', '400 «Selecciona el nivel de progreso»', async () =>
  es(await pedir(tut2, 'POST', '/tutorias/3/seguimiento', { asistio: true, observaciones: 'Falta el nivel' }), 400, 'nivel de progreso'));
await caso('PT-02', 'M5 Seguimiento', 'Seguimiento válido de una tutoría ya ocurrida (09/11) la pasa a Realizada', '204 + estado Realizada', async () => {
  const r = await pedir(tut2, 'POST', '/tutorias/3/seguimiento', { asistio: true, nivel_progreso: 'Avanzado', observaciones: 'Prueba automatizada: buen avance.' });
  const t = await pedir(tut2, 'GET', '/tutorias/3');
  return { ok: r.status === 204 && t.datos?.estado === 'Realizada', obtenido: `${r.status}, estado ${t.datos?.estado}` };
});
await caso('PT-03', 'M4 Tutorías', 'Intentar cancelar una tutoría ya Realizada', '400 (disparador gestionar_tutoria)', async () =>
  es(await pedir(tut2, 'POST', '/tutorias/3/cancelar', { motivo: 'Ya no' }), 400));
await caso('PT-04', 'M4 Reprogramación', 'Tutor propone reprogramar y el estudiante acepta', '204/204; horario cambia, franja anterior Disponible', async () => {
  const p = await pedir(tut, 'POST', `/tutorias/${tutoria}/reprogramar`, { id_horario_propuesto: f2, motivo: 'Prueba automatizada' });
  const t = await pedir(est, 'GET', `/tutorias/${tutoria}`);
  const idR = t.datos?.reprogramacion_pendiente?.id_reprogramacion;
  const a = await pedir(est, 'POST', `/reprogramaciones/${idR}/aceptar`);
  const t2 = await pedir(est, 'GET', `/tutorias/${tutoria}`);
  const fr = await pedir(tut, 'GET', `/horarios/mios?desde=${F1}&hasta=${F1}`);
  const libre = fr.datos?.find((f) => f.id_horario === f1)?.estado;
  const ok = p.status === 204 && a.status === 204 && t2.datos?.franja.id_horario === f2 && t2.datos?.reprogramada === true && libre === 'Disponible';
  return { ok, obtenido: `${p.status}/${a.status}, nueva franja ${t2.datos?.franja.fecha}, reprogramada=${t2.datos?.reprogramada}, anterior ${libre}` };
});
await caso('PT-05', 'M4 Seguridad', 'Otro estudiante intenta ver una tutoría ajena', '404', async () =>
  es(await pedir(est2, 'GET', `/tutorias/${tutoria}`), 404));
await caso('CP-04', 'M4 Tutorías', 'Cancelar sin motivo', '400 «Indica el motivo para continuar»', async () =>
  es(await pedir(tut, 'POST', `/tutorias/${tutoria}/cancelar`, { motivo: '' }), 400, 'Indica el motivo'));
await caso('PT-06', 'M4 Tutorías', 'Cancelar con motivo libera la franja', '204 + Cancelada; franja Disponible', async () => {
  const r = await pedir(tut, 'POST', `/tutorias/${tutoria}/cancelar`, { motivo: 'Prueba automatizada: reunión de facultad.' });
  const t = await pedir(est, 'GET', `/tutorias/${tutoria}`);
  const fr = await pedir(tut, 'GET', `/horarios/mios?desde=${F2}&hasta=${F2}`);
  const libre = fr.datos?.find((f) => f.id_horario === f2)?.estado;
  return { ok: r.status === 204 && t.datos?.estado === 'Cancelada' && libre === 'Disponible', obtenido: `${r.status}, ${t.datos?.estado}, franja ${libre}` };
});
await caso('PH-05', 'M3 Horarios', 'Eliminar una franja que tiene una tutoría asociada', '400', async () =>
  es(await pedir(tut, 'DELETE', `/horarios/${f2}`), 400));

// ====================== M8 Usuarios ======================
await caso('PU-01', 'M8 Usuarios', 'Registrar usuario con un correo que ya existe', '409', async () =>
  es(await pedir(coord, 'POST', '/usuarios', {
    rol: 'Estudiante', nombre_usuario: 'prueba01', nombre_completo: 'Usuario Prueba', identificacion: 'PRB001',
    correo: 'ga22001@ues.edu.sv', contrasena: 'Prueba2026!', estudiante: { id_carrera: 1, ciclo: 1 },
  }), 409));
await caso('PU-02', 'M8 Usuarios', 'Desactivar usuario impide su login (y se reactiva)', '204; login 403; 204', async () => {
  const d = await pedir(coord, 'PATCH', '/usuarios/9/activo', { activo: false });
  const { r } = await entrar('go22003');
  const a = await pedir(coord, 'PATCH', '/usuarios/9/activo', { activo: true });
  return { ok: d.status === 204 && r.status === 403 && a.status === 204, obtenido: `${d.status}; login ${r.status}; ${a.status}` };
});
await caso('PU-03', 'M8 Perfil', 'Cambiar contraseña con la actual incorrecta', '400 «La contraseña actual es incorrecta»', async () =>
  es(await pedir(est2, 'POST', '/perfil/contrasena', { actual: 'no-es', nueva: 'NuevaClave2026!' }), 400, 'actual es incorrecta'));
await caso('PU-04', 'M2 Documento', 'Adjuntar un archivo .txt como documento de apoyo', '400 (solo PDF, Word o imagen)', async () => {
  const form = new FormData();
  form.append('archivo', new Blob(['hola'], { type: 'text/plain' }), 'notas.txt');
  return es(await pedir(est, 'POST', '/solicitudes/4/documento', form, true), 400, 'Solo se permiten');
});

// ====================== M7 Reportes ======================
await caso('PR-01', 'M7 Reportes', 'Métricas del coordinador', '200 con totales', async () => {
  const r = await pedir(coord, 'GET', '/reportes/metricas');
  const ok = r.status === 200 && typeof r.datos?.total_usuarios === 'number' && Array.isArray(r.datos?.participacion_por_carrera);
  return { ok, obtenido: `${r.status} usuarios=${r.datos?.total_usuarios}, asistencia=${r.datos?.tasa_asistencia}%` };
});
await caso('PR-02', 'M7 Reportes', 'Vista previa del reporte «Asistencia estudiantil»', '200 con columnas y filas', async () => {
  const r = await pedir(coord, 'POST', '/reportes/vista-previa', { tipo: 'Asistencia estudiantil', fecha_desde: '2026-01-01', fecha_hasta: '2026-12-31' });
  return { ok: r.status === 200 && r.datos?.columnas?.length === 6, obtenido: `${r.status} ${r.datos?.columnas?.length} columnas, ${r.datos?.filas?.length} filas` };
});
await caso('PR-03', 'M7 Reportes', 'Exportar reporte a PDF', '200 application/pdf', async () => {
  const r = await pedir(coord, 'POST', '/reportes', { tipo: 'Tutorías realizadas', fecha_desde: '2026-01-01', fecha_hasta: '2026-12-31', formato: 'PDF' });
  return { ok: r.status === 200 && r.tipo.includes('pdf'), obtenido: `${r.status} ${r.tipo}` };
});
await caso('PR-04', 'M7 Seguridad', 'Estudiante intenta ver métricas', '403', async () =>
  es(await pedir(est, 'GET', '/reportes/metricas'), 403));

// ---------- resumen ----------
const pasan = resultados.filter((r) => r.resultado === 'PASA').length;
const resumen = { fecha: new Date().toISOString(), api: API, total: resultados.length, pasan, fallan: resultados.length - pasan };
fs.writeFileSync(SALIDA, JSON.stringify({ resumen, resultados }, null, 2));
console.log(`\n${pasan}/${resultados.length} casos pasan`);
