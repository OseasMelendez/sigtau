import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import {
  ahora,
  fechaDesdeTexto,
  horaDesdeTexto,
  textoFecha,
} from '../common/fecha.util';
import { mapFranja } from '../common/mapeos';
import { FECHA, HORA, id, rango } from '../common/validacion';
import { Roles, Usuario, type UsuarioActual } from '../auth/decorators';

export class FranjaDto {
  @IsString() @Matches(FECHA, { message: 'Fecha inválida' }) fecha!: string;
  @IsString()
  @Matches(HORA, { message: 'Hora de inicio inválida' })
  hora_inicio!: string;
  @IsString()
  @Matches(HORA, { message: 'Hora de fin inválida' })
  hora_fin!: string;
}

/** M3 Gestión de horarios (RF-05, RF-06). Solapamiento y fin > inicio los valida la BD. */
@Injectable()
export class HorariosService {
  constructor(private prisma: PrismaService) {}

  async mios(idTutor: number, desde: string, hasta: string) {
    const lista = await this.prisma.horario_tutor.findMany({
      where: {
        id_tutor: idTutor,
        fecha: { gte: fechaDesdeTexto(desde), lte: fechaDesdeTexto(hasta) },
      },
      orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }],
    });
    return lista.map(mapFranja);
  }

  private validarFecha(d: FranjaDto) {
    if (d.fecha < textoFecha(ahora()))
      throw new BadRequestException('La fecha no puede ser anterior a hoy');
    if (d.hora_fin <= d.hora_inicio)
      throw new BadRequestException(
        'La hora de fin debe ser posterior a la hora de inicio.',
      );
  }

  private datos(d: FranjaDto) {
    return {
      fecha: fechaDesdeTexto(d.fecha),
      hora_inicio: horaDesdeTexto(d.hora_inicio),
      hora_fin: horaDesdeTexto(d.hora_fin),
    };
  }

  private async propia(idTutor: number, idHorario: number) {
    const h = await this.prisma.horario_tutor.findFirst({
      where: { id_horario: idHorario, id_tutor: idTutor },
      include: {
        solicitud_tutoria: true,
        tutoria: true,
        reprogramacion_propuesta: true,
        reprogramacion_anterior: true,
      },
    });
    if (!h) throw new NotFoundException('La franja no existe.');
    return h;
  }

  async crear(idTutor: number, d: FranjaDto) {
    this.validarFecha(d);
    return mapFranja(
      await this.prisma.horario_tutor.create({
        data: { id_tutor: idTutor, ...this.datos(d) },
      }),
    );
  }

  async editar(idTutor: number, idHorario: number, d: FranjaDto) {
    this.validarFecha(d);
    const h = await this.propia(idTutor, idHorario);
    const ocupada =
      h.estado !== 'Disponible' ||
      h.solicitud_tutoria.some((s) => s.estado !== 'Rechazada') ||
      h.tutoria.length > 0;
    if (ocupada)
      throw new BadRequestException(
        'Solo puedes modificar franjas disponibles sin solicitudes pendientes',
      );
    return mapFranja(
      await this.prisma.horario_tutor.update({
        where: { id_horario: idHorario },
        data: this.datos(d),
      }),
    );
  }

  async eliminar(idTutor: number, idHorario: number) {
    const h = await this.propia(idTutor, idHorario);
    if (
      h.estado !== 'Disponible' ||
      h.solicitud_tutoria.length ||
      h.tutoria.length ||
      h.reprogramacion_propuesta.length ||
      h.reprogramacion_anterior.length
    ) {
      throw new BadRequestException(
        'No se puede eliminar una franja que tiene solicitudes o tutorías asociadas',
      );
    }
    await this.prisma.horario_tutor.delete({
      where: { id_horario: idHorario },
    });
  }
}

@Controller('horarios')
@Roles('Tutor')
export class HorariosController {
  constructor(private s: HorariosService) {}

  @Get('mios')
  mios(
    @Usuario() u: UsuarioActual,
    @Query('desde') d?: string,
    @Query('hasta') h?: string,
  ) {
    const r = rango(d, h);
    return this.s.mios(u.id_usuario, r.desde, r.hasta);
  }
  @Post() crear(@Usuario() u: UsuarioActual, @Body() d: FranjaDto) {
    return this.s.crear(u.id_usuario, d);
  }
  @Put(':id') editar(
    @Usuario() u: UsuarioActual,
    @Param('id') i: string,
    @Body() d: FranjaDto,
  ) {
    return this.s.editar(u.id_usuario, id(i), d);
  }
  @Delete(':id') @HttpCode(204) eliminar(
    @Usuario() u: UsuarioActual,
    @Param('id') i: string,
  ) {
    return this.s.eliminar(u.id_usuario, id(i));
  }
}

@Module({ controllers: [HorariosController], providers: [HorariosService] })
export class HorariosModule {}
