import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Convierte cualquier error en una respuesta JSON { statusCode, message }.
 *
 * - Errores HTTP de Nest (validaciones, 401, 403...) pasan tal cual.
 * - Los RAISE EXCEPTION de los disparadores (código P0001) ya traen un mensaje
 *   pensado para el usuario, así que se devuelven como 400 con ese texto.
 * - Las violaciones de restricciones se traducen a mensajes legibles.
 * - Cualquier otro error se registra en el log y el usuario recibe un mensaje
 *   genérico, sin detalles técnicos (RNF-03).
 */
@Catch()
export class DbErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const status = exception.getStatus();
      let message: string | string[] =
        typeof body === 'string' ? body : (body as any).message;
      if (Array.isArray(message)) message = message[0]; // primer error de validación
      return res.status(status).json({ statusCode: status, message });
    }

    const traducido = traducirErrorBD(exception);
    if (traducido) {
      return res
        .status(traducido.status)
        .json({ statusCode: traducido.status, message: traducido.message });
    }

    this.logger.error(exception);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'Ocurrió un error inesperado. Intenta de nuevo.',
    });
  }
}

const NOMBRES_CAMPOS: Record<string, string> = {
  nombre_usuario: 'nombre de usuario',
  correo: 'correo',
  identificacion: 'identificación (carnet o documento)',
};

const RESTRICCIONES: Record<string, string> = {
  exc_horario_sin_solapamiento:
    'La franja se solapa con otra franja que ya registraste.',
  chk_horario_fin_posterior:
    'La hora de fin debe ser posterior a la hora de inicio.',
  uq_tutoria_horario_programada: 'Ya hay una tutoría programada en esa franja.',
  uq_reprogramacion_pendiente:
    'Esta tutoría ya tiene una reprogramación pendiente de respuesta.',
  uq_sesion_activa: 'Ya existe una sesión abierta con esta cuenta.',
  chk_seguimiento_nivel:
    'Si el estudiante asistió, el nivel de progreso es obligatorio.',
  chk_tutoria_cancelacion: 'Indica el motivo para continuar',
};

function traducirErrorBD(
  e: unknown,
): { status: number; message: string } | null {
  // Errores conocidos de Prisma
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      const campos: string[] =
        (e.meta as any)?.target ??
        (e.meta as any)?.driverAdapterError?.cause?.constraint?.fields ??
        [];
      const campo = NOMBRES_CAMPOS[campos[0]] ?? campos.join(', ');
      return {
        status: 409,
        message: `Ya existe un registro con ese ${campo || 'valor'}.`,
      };
    }
    if (e.code === 'P2025')
      return { status: 404, message: 'El registro no existe.' };
    if (e.code === 'P2003')
      return { status: 400, message: 'Un dato relacionado no existe.' };
    const causa = (e.meta as any)?.driverAdapterError?.cause;
    if (causa) return traducirCausaPg(causa.originalCode, causa.originalMessage);
  }

  // Errores que vienen directo del adaptador de PostgreSQL
  const err = e as any;
  if (err?.name === 'DriverAdapterError') {
    const causa = err.cause ?? {};
    return traducirCausaPg(
      causa.originalCode ?? causa.code,
      causa.originalMessage ?? err.message,
    );
  }
  return null;
}

function traducirCausaPg(
  codigo: string | undefined,
  mensaje: string = '',
): { status: number; message: string } | null {
  // RAISE EXCEPTION de los disparadores: el mensaje ya es para el usuario
  if (codigo === 'P0001') return { status: 400, message: mensaje };

  for (const [restriccion, texto] of Object.entries(RESTRICCIONES)) {
    if (mensaje.includes(restriccion)) return { status: 400, message: texto };
  }
  if (codigo === '23P01')
    return {
      status: 400,
      message: 'La franja se solapa con otra franja que ya registraste.',
    };
  if (codigo === '23514')
    return { status: 400, message: 'Algún dato no cumple las reglas del sistema.' };
  if (codigo === '23505')
    return { status: 409, message: 'Ya existe un registro con esos datos.' };
  if (codigo === '23503')
    return { status: 400, message: 'Un dato relacionado no existe.' };
  // Sin código pero con mensaje de un disparador
  if (!codigo && mensaje && !mensaje.includes('constraint'))
    return { status: 400, message: mensaje };
  return null;
}
