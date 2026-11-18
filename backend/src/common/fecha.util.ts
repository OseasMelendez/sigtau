/**
 * Manejo de fechas en SIGTAU.
 *
 * La base usa TIMESTAMP / DATE / TIME sin zona horaria con la hora local de
 * El Salvador (UTC-6, sin horario de verano). Prisma lee y escribe esas columnas
 * como si fueran UTC, así que la convención del proyecto es:
 *   - Los Date que vienen de la BD tienen en sus campos UTC la hora local.
 *     En el frontend se formatean SIEMPRE con timeZone: 'UTC'.
 *   - Para guardar "ahora" se usa ahora(), nunca new Date().
 */
const OFFSET_EL_SALVADOR_MS = 6 * 60 * 60 * 1000;

/** Fecha y hora actual de El Salvador, lista para guardar con Prisma. */
export function ahora(): Date {
  return new Date(Date.now() - OFFSET_EL_SALVADOR_MS);
}

/** Suma minutos a una fecha. */
export function sumarMinutos(fecha: Date, minutos: number): Date {
  return new Date(fecha.getTime() + minutos * 60 * 1000);
}

/** "2026-11-09" -> Date para columnas DATE. */
export function fechaDesdeTexto(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

/** "09:30" -> Date para columnas TIME. */
export function horaDesdeTexto(hhMm: string): Date {
  return new Date(`1970-01-01T${hhMm}:00.000Z`);
}

/** Date de columna DATE -> "2026-11-09". */
export function textoFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Date de columna TIME -> "09:30". */
export function textoHora(hora: Date): string {
  return hora.toISOString().slice(11, 16);
}
