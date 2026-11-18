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
