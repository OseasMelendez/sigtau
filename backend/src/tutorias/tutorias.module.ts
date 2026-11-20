import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { ahora } from '../common/fecha.util';
import {
  INCLUDE_TUTORIA,
  mapTutoria,
  notificar,
  textoFranjaCorto,
} from '../common/mapeos';
import { id } from '../common/validacion';
import { Roles, Usuario, type UsuarioActual } from '../auth/decorators';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CancelarDto {
  @Transform(recortar)
  @IsString({ message: 'Indica el motivo para continuar' })
  @IsNotEmpty({ message: 'Indica el motivo para continuar' })
  @MaxLength(255, { message: 'El motivo no puede superar 255 caracteres' })
  motivo!: string;
}

export class ReprogramarDto {
  @IsInt({ message: 'Selecciona un nuevo horario' })
  id_horario_propuesto!: number;
  @Transform(recortar)
  @IsString({ message: 'Indica el motivo de la reprogramación' })
  @IsNotEmpty({ message: 'Indica el motivo de la reprogramación' })
  @MaxLength(255, { message: 'El motivo no puede superar 255 caracteres' })
  motivo!: string;
}

export class SeguimientoDto {
  @IsBoolean({ message: 'Indica si el estudiante asistió' }) asistio!: boolean;
  @IsOptional()
  @IsIn(['Bajo', 'Medio', 'Avanzado'], {
    message: 'Nivel de progreso inválido',
  })
  nivel_progreso?: string;
  @Transform(recortar)
  @IsString({ message: 'Las observaciones son obligatorias' })
  @IsNotEmpty({ message: 'Las observaciones son obligatorias' })
  @MaxLength(2000, { message: 'Las observaciones son demasiado largas' })
  observaciones!: string;
}

/**
 * M4 Programación/cancelación/reprogramación y M5 Seguimiento (RF-08, RF-09, RF-13, RF-14).
 * Las reglas de estado y de franjas las aplican los disparadores D3, D4 y D5.
 */
@Injectable()
export class TutoriasService {
  constructor(private prisma: PrismaService) {}

  /** Filtro de las tutorías en las que participa el usuario. */
  private dondeParticipa(u: UsuarioActual) {
    return u.rol === 'Tutor'
      ? { horario_tutor: { id_tutor: u.id_usuario } }
      : { solicitud_tutoria: { id_estudiante: u.id_usuario } };
  }

  async mias(u: UsuarioActual) {
    const lista = await this.prisma.tutoria.findMany({
      where: this.dondeParticipa(u),
      include: INCLUDE_TUTORIA,
      orderBy: [
        { horario_tutor: { fecha: 'desc' } },
        { horario_tutor: { hora_inicio: 'desc' } },
      ],
    });
    return lista.map(mapTutoria);
  }

  private async buscar(u: UsuarioActual, idTutoria: number) {
    const t = await this.prisma.tutoria.findFirst({
      where: { id_tutoria: idTutoria, ...this.dondeParticipa(u) },
      include: INCLUDE_TUTORIA,
    });
    if (!t) throw new NotFoundException('La tutoría no existe.');
    return t;
  }

  async detalle(u: UsuarioActual, idTutoria: number) {
    return mapTutoria(await this.buscar(u, idTutoria));
  }

  /** RF-13: cancelar exige motivo y libera la franja (D3). */
  async cancelar(u: UsuarioActual, idTutoria: number, motivo: string) {
    const t = await this.buscar(u, idTutoria);
    if (t.estado !== 'Programada')
      throw new BadRequestException(
        `Una tutoría ${t.estado.toLowerCase()} no se puede cancelar.`,
      );
    const momento = ahora();
    await this.prisma.$transaction(async (tx) => {
      // Una reprogramación pendiente deja de tener sentido
      await tx.reprogramacion.updateMany({
        where: { id_tutoria: idTutoria, estado: 'Pendiente' },
        data: { estado: 'Rechazada', fecha_respuesta: momento },
      });
      await tx.tutoria.update({
        where: { id_tutoria: idTutoria },
        data: {
          estado: 'Cancelada',
          motivo_cancelacion: motivo,
          fecha_cancelacion: momento,
        },
      });
      await notificar(
        tx,
        t.solicitud_tutoria.id_estudiante,
        'Cancelación',
        'Tutoría cancelada',
        `${t.solicitud_tutoria.asignatura.nombre} del ${textoFranjaCorto(t.horario_tutor)} fue cancelada: ${motivo}`,
      );
    });
  }

  /** RF-14: el tutor propone una franja suya Disponible; el estudiante decide (D4). */
  async reprogramar(u: UsuarioActual, idTutoria: number, d: ReprogramarDto) {
    const t = await this.buscar(u, idTutoria);
    if (t.reprogramacion.length)
      throw new BadRequestException(
        'Esta tutoría ya tiene una reprogramación pendiente de respuesta.',
      );
    const momento = ahora();
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.reprogramacion.create({
        data: {
          id_tutoria: idTutoria,
          id_horario_anterior: t.id_horario,
          id_horario_propuesto: d.id_horario_propuesto,
          motivo: d.motivo,
          fecha_propuesta: momento,
        },
        include: { horario_propuesto: true },
      });
      await notificar(
        tx,
        t.solicitud_tutoria.id_estudiante,
        'Reprogramación',
        'Propuesta de reprogramación',
        `${u.nombre_completo} propone mover ${t.solicitud_tutoria.asignatura.nombre} al ${textoFranjaCorto(r.horario_propuesto)}.`,
      );
    });
  }

  /** RF-08: registrar seguimiento; D5 rechaza sesiones futuras y marca la tutoría Realizada. */
  async seguimiento(u: UsuarioActual, idTutoria: number, d: SeguimientoDto) {
    const t = await this.buscar(u, idTutoria);
    if (d.asistio && !d.nivel_progreso)
      throw new BadRequestException('Selecciona el nivel de progreso');
    await this.prisma.$transaction(async (tx) => {
      await tx.seguimiento.create({
        data: {
          id_tutoria: idTutoria,
          asistio: d.asistio,
          nivel_progreso: d.asistio ? d.nivel_progreso : null,
          observaciones: d.observaciones,
          fecha_registro: ahora(),
        },
      });
      await notificar(
        tx,
        t.solicitud_tutoria.id_estudiante,
        'Seguimiento',
        'Seguimiento registrado',
        `${u.nombre_completo} registró observaciones de tu sesión de ${t.solicitud_tutoria.asignatura.nombre}.`,
      );
    });
  }

  /** El estudiante acepta o rechaza la propuesta de reprogramación. */
  async responderReprogramacion(
    u: UsuarioActual,
    idReprog: number,
    aceptar: boolean,
  ) {
    const r = await this.prisma.reprogramacion.findFirst({
      where: {
        id_reprogramacion: idReprog,
        tutoria: { solicitud_tutoria: { id_estudiante: u.id_usuario } },
      },
      include: {
        horario_propuesto: true,
        tutoria: {
          include: {
            horario_tutor: true,
            solicitud_tutoria: { include: { asignatura: true } },
          },
        },
      },
    });
    if (!r) throw new NotFoundException('La reprogramación no existe.');
    if (r.estado !== 'Pendiente')
      throw new BadRequestException('Esta reprogramación ya fue respondida.');
    await this.prisma.$transaction(async (tx) => {
      await tx.reprogramacion.update({
        where: { id_reprogramacion: idReprog },
        data: {
          estado: aceptar ? 'Aceptada' : 'Rechazada',
          fecha_respuesta: ahora(),
        },
      });
      await notificar(
        tx,
        r.tutoria.horario_tutor.id_tutor,
        'Reprogramación',
        aceptar ? 'Reprogramación aceptada' : 'Reprogramación rechazada',
        `${u.nombre_completo} ${aceptar ? 'aceptó' : 'rechazó'} mover ${r.tutoria.solicitud_tutoria.asignatura.nombre} al ${textoFranjaCorto(r.horario_propuesto)}.`,
      );
    });
  }
}

@Controller()
export class TutoriasController {
  constructor(private s: TutoriasService) {}

  @Get('tutorias') @Roles('Estudiante', 'Tutor') mias(
    @Usuario() u: UsuarioActual,
  ) {
    return this.s.mias(u);
  }
  @Get('tutorias/:id') @Roles('Estudiante', 'Tutor') detalle(
    @Usuario() u: UsuarioActual,
    @Param('id') i: string,
  ) {
    return this.s.detalle(u, id(i));
  }
  @Post('tutorias/:id/cancelar')
  @Roles('Tutor')
  @HttpCode(204)
  cancelar(
    @Usuario() u: UsuarioActual,
    @Param('id') i: string,
    @Body() d: CancelarDto,
  ) {
    return this.s.cancelar(u, id(i), d.motivo);
  }
  @Post('tutorias/:id/reprogramar')
  @Roles('Tutor')
  @HttpCode(204)
  reprogramar(
    @Usuario() u: UsuarioActual,
    @Param('id') i: string,
    @Body() d: ReprogramarDto,
  ) {
    return this.s.reprogramar(u, id(i), d);
  }
  @Post('tutorias/:id/seguimiento')
  @Roles('Tutor')
  @HttpCode(204)
  seguimiento(
    @Usuario() u: UsuarioActual,
    @Param('id') i: string,
    @Body() d: SeguimientoDto,
  ) {
    return this.s.seguimiento(u, id(i), d);
  }
  @Post('reprogramaciones/:id/aceptar')
  @Roles('Estudiante')
  @HttpCode(204)
  aceptar(@Usuario() u: UsuarioActual, @Param('id') i: string) {
    return this.s.responderReprogramacion(u, id(i), true);
  }
  @Post('reprogramaciones/:id/rechazar')
  @Roles('Estudiante')
  @HttpCode(204)
  rechazar(@Usuario() u: UsuarioActual, @Param('id') i: string) {
    return this.s.responderReprogramacion(u, id(i), false);
  }
}

@Module({ controllers: [TutoriasController], providers: [TutoriasService] })
export class TutoriasModule {}
