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
  INCLUDE_SOLICITUD,
  mapSolicitudEstudiante,
  mapSolicitudTutor,
  notificar,
  textoFranjaCorto,
} from '../common/mapeos';
import { id } from '../common/validacion';
import { Roles, Usuario, type UsuarioActual } from '../auth/decorators';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearSolicitudDto {
  @IsInt({ message: 'Selecciona una asignatura' }) id_asignatura!: number;
  @IsInt({ message: 'Selecciona una franja disponible' }) id_horario!: number;
  @Transform(recortar)
  @IsString({ message: 'La dificultad es obligatoria' })
  @IsNotEmpty({ message: 'La dificultad es obligatoria' })
  @MaxLength(500, { message: 'La dificultad no puede superar 500 caracteres' })
  descripcion_dificultad!: string;
}

export class AprobarDto {
  @Transform(recortar)
  @IsString({ message: 'Indica el lugar de la tutoría' })
  @IsNotEmpty({ message: 'Indica el lugar de la tutoría' })
  @MaxLength(100, { message: 'El lugar no puede superar 100 caracteres' })
  lugar!: string;
}

export class RechazarDto {
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(255, { message: 'El motivo no puede superar 255 caracteres' })
  motivo_rechazo?: string;
}

/** M2 Gestión de solicitudes (RF-03, RF-04, RF-07). Las reglas de la franja las valida el disparador D2. */
@Injectable()
export class SolicitudesService {
  constructor(private prisma: PrismaService) {}

  async mias(idEstudiante: number) {
    const lista = await this.prisma.solicitud_tutoria.findMany({
      where: { id_estudiante: idEstudiante },
      include: INCLUDE_SOLICITUD,
      orderBy: { fecha_solicitud: 'desc' },
    });
    return lista.map(mapSolicitudEstudiante);
  }

  async crear(
    u: { id_usuario: number; nombre_completo: string },
    d: CrearSolicitudDto,
  ) {
    const s = await this.prisma.$transaction(async (tx) => {
      const nueva = await tx.solicitud_tutoria.create({
        data: {
          id_estudiante: u.id_usuario,
          id_asignatura: d.id_asignatura,
          id_horario: d.id_horario,
          descripcion_dificultad: d.descripcion_dificultad,
          fecha_solicitud: ahora(),
        },
        include: INCLUDE_SOLICITUD,
      });
      await notificar(
        tx,
        nueva.horario_tutor.id_tutor,
        'Solicitud',
        'Nueva solicitud de tutoría',
        `${u.nombre_completo} solicita tutoría de ${nueva.asignatura.nombre} para el ${textoFranjaCorto(nueva.horario_tutor)}.`,
      );
      return nueva;
    });
    return mapSolicitudEstudiante(s);
  }

  async pendientes(idTutor: number) {
    const lista = await this.prisma.solicitud_tutoria.findMany({
      where: { estado: 'Pendiente', horario_tutor: { id_tutor: idTutor } },
      include: INCLUDE_SOLICITUD,
      orderBy: { fecha_solicitud: 'asc' },
    });
    return lista.map(mapSolicitudTutor);
  }

  private async pendienteDelTutor(idTutor: number, idSolicitud: number) {
    const s = await this.prisma.solicitud_tutoria.findFirst({
      where: {
        id_solicitud: idSolicitud,
        horario_tutor: { id_tutor: idTutor },
      },
      include: INCLUDE_SOLICITUD,
    });
    if (!s) throw new NotFoundException('La solicitud no existe.');
    if (s.estado !== 'Pendiente')
      throw new BadRequestException('La solicitud ya fue respondida');
    return s;
  }

  /** RF-04 / RF-07: aprobar crea la tutoría con el horario elegido y ocupa la franja (disparador D3). */
  async aprobar(u: UsuarioActual, idSolicitud: number, lugar: string) {
    const s = await this.pendienteDelTutor(u.id_usuario, idSolicitud);
    const momento = ahora();
    return this.prisma.$transaction(async (tx) => {
      await tx.solicitud_tutoria.update({
        where: { id_solicitud: idSolicitud },
        data: { estado: 'Aprobada', fecha_respuesta: momento },
      });
      const t = await tx.tutoria.create({
        data: {
          id_solicitud: idSolicitud,
          id_horario: s.id_horario,
          lugar,
          fecha_programacion: momento,
        },
      });
      await notificar(
        tx,
        s.id_estudiante,
        'Tutoría',
        'Tutoría programada',
        `${s.asignatura.nombre} con ${u.nombre_completo} el ${textoFranjaCorto(s.horario_tutor)}, ${lugar}.`,
      );
      return { id_tutoria: t.id_tutoria };
    });
  }

  async rechazar(u: UsuarioActual, idSolicitud: number, motivo?: string) {
    const s = await this.pendienteDelTutor(u.id_usuario, idSolicitud);
    await this.prisma.$transaction(async (tx) => {
      await tx.solicitud_tutoria.update({
        where: { id_solicitud: idSolicitud },
        data: {
          estado: 'Rechazada',
          motivo_rechazo: motivo || null,
          fecha_respuesta: ahora(),
        },
      });
      await notificar(
        tx,
        s.id_estudiante,
        'Solicitud',
        'Solicitud rechazada',
        `Tu solicitud de ${s.asignatura.nombre} fue rechazada${motivo ? `: ${motivo}` : '.'}`,
      );
    });
  }
}

@Controller('solicitudes')
export class SolicitudesController {
  constructor(private s: SolicitudesService) {}

  @Get('mias') @Roles('Estudiante') mias(@Usuario() u: UsuarioActual) {
    return this.s.mias(u.id_usuario);
  }
  @Post() @Roles('Estudiante') crear(
    @Usuario() u: UsuarioActual,
    @Body() d: CrearSolicitudDto,
  ) {
    return this.s.crear(u, d);
  }
  @Get('pendientes') @Roles('Tutor') pendientes(@Usuario() u: UsuarioActual) {
    return this.s.pendientes(u.id_usuario);
  }
  @Post(':id/aprobar')
  @Roles('Tutor')
  @HttpCode(200)
  aprobar(
    @Usuario() u: UsuarioActual,
    @Param('id') i: string,
    @Body() d: AprobarDto,
  ) {
    return this.s.aprobar(u, id(i), d.lugar);
  }
  @Post(':id/rechazar')
  @Roles('Tutor')
  @HttpCode(204)
  rechazar(
    @Usuario() u: UsuarioActual,
    @Param('id') i: string,
    @Body() d: RechazarDto,
  ) {
    return this.s.rechazar(u, id(i), d.motivo_rechazo);
  }
}

@Module({
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
})
export class SolicitudesModule {}
