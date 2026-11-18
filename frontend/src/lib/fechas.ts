/**
 * La API devuelve fechas cuyos campos UTC ya son la hora local de El Salvador
 * (ver backend/src/common/fecha.util.ts). Por eso aquí SIEMPRE se formatea con
 * timeZone: 'UTC'. No uses toLocaleString() sin esa opción.
 */
const UTC = { timeZone: 'UTC' } as const;

/** "2026-11-09T00:00:00.000Z" -> "9 de noviembre de 2026" */
export const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString('es-SV', { ...UTC, day: 'numeric', month: 'long', year: 'numeric' });

/** -> "09/11/2026" */
export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-SV', { ...UTC, day: '2-digit', month: '2-digit', year: 'numeric' });

/** -> "15 jun" */
export const diaMes = (iso: string) =>
  new Date(iso).toLocaleDateString('es-SV', { ...UTC, day: 'numeric', month: 'short' });

/** Columna TIME "1970-01-01T09:00:00.000Z" -> "09:00" */
export const hora = (iso: string) => new Date(iso).toISOString().slice(11, 16);

/** -> "09/11/2026, 09:00" */
export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-SV', {
    ...UTC, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });

// ---------- Fechas 'YYYY-MM-DD' de las franjas ----------

/** Fecha de hoy en El Salvador, 'YYYY-MM-DD'. */
export const hoyISO = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

/** Hora actual en El Salvador, 'HH:mm'. */
export const horaActual = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(11, 16);

export const sumarDias = (fecha: string, dias: number) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

/** Lunes de la semana de la fecha dada. */
export const lunesDe = (fecha: string) => {
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia);
};

/** 1 = lunes ... 7 = domingo */
export const diaSemana = (fecha: string) => {
  const d = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
};

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** '2026-06-17' -> 'Miércoles, 17 de junio de 2026' */
export const fechaConDia = (fecha: string) =>
  capital(new Date(`${fecha}T00:00:00Z`).toLocaleDateString('es-SV', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }));

/** '2026-06-17' -> 'mié' */
export const diaCorto = (fecha: string) =>
  new Date(`${fecha}T00:00:00Z`).toLocaleDateString('es-SV', { timeZone: 'UTC', weekday: 'short' }).replace('.', '');

/** Texto de una franja: 'Miércoles, 17 de junio de 2026 · 10:00 – 11:00' */
export const textoFranja = (f: { fecha: string; hora_inicio: string; hora_fin: string }) =>
  `${fechaConDia(f.fecha)} · ${f.hora_inicio} – ${f.hora_fin}`;

/** Duración entre dos horas 'HH:mm' -> '1 h 30 min' */
export const duracion = (inicio: string, fin: string) => {
  const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const total = m(fin) - m(inicio);
  const h = Math.floor(total / 60), min = total % 60;
  return [h && `${h} h`, min && `${min} min`].filter(Boolean).join(' ');
};

/** ¿La franja ya empezó? (para habilitar el seguimiento) */
export const yaOcurrio = (f: { fecha: string; hora_inicio: string }) => {
  const hoy = hoyISO();
  return f.fecha < hoy || (f.fecha === hoy && f.hora_inicio <= horaActual());
};

/** 'hace 5 min', 'hace 2 h', 'ayer', o la fecha */
export const haceCuanto = (iso: string) => {
  const ahoraLocal = Date.now() - 6 * 3600 * 1000;
  const min = Math.round((ahoraLocal - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'Justo ahora';
  if (min < 60) return `Hace ${min} min`;
  if (min < 24 * 60) return `Hace ${Math.round(min / 60)} h`;
  if (min < 48 * 60) return 'Ayer';
  return fechaCorta(iso);
};
