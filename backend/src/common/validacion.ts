import { BadRequestException } from '@nestjs/common';

export const FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Valida un rango ?desde&hasta de la URL ('YYYY-MM-DD'). */
export function rango(desde?: string, hasta?: string) {
  if (!desde || !hasta || !FECHA.test(desde) || !FECHA.test(hasta)) {
    throw new BadRequestException(
      'Indica un rango de fechas válido (desde y hasta).',
    );
  }
  return { desde, hasta };
}

/** Convierte un parámetro de ruta a número entero o responde 400. */
export function id(valor: string) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0)
    throw new BadRequestException('Identificador inválido.');
  return n;
}
