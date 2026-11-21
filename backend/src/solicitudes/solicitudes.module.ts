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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join, resolve } from 'path';
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

// ---------- Documento de apoyo (opcional): PDF, Word o imagen, máx. 5 MB ----------
/** Carpeta donde se guardan los archivos (backend/uploads/solicitudes, fuera de git) */
const CARPETA_DOCS = resolve(process.cwd(), 'uploads', 'solicitudes');
const MAX_DOC = 5 * 1024 * 1024;
const TIPOS_DOC: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};
interface ArchivoSubido {
  originalname: string;
  size: number;
  buffer: Buffer;
}

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

  /** Guarda el documento de una solicitud propia y Pendiente (se sube justo después de crearla). */
  async subirDocumento(
    idEstudiante: number,
    idSolicitud: number,
    a?: ArchivoSubido,
  ) {
    if (!a) throw new BadRequestException('Selecciona un archivo');
    const ext = extname(a.originalname).toLowerCase();
    if (!TIPOS_DOC[ext])
      throw new BadRequestException(
        'Solo se permiten archivos PDF, Word o imágenes (PNG, JPG)',
      );
    if (a.size > MAX_DOC)
      throw new BadRequestException('El documento no puede superar 5 MB');
    const s = await this.prisma.solicitud_tutoria.findFirst({
      where: { id_solicitud: idSolicitud, id_estudiante: idEstudiante },
    });
    if (!s) throw new NotFoundException('La solicitud no existe.');
    if (s.estado !== 'Pendiente')
      throw new BadRequestException(
        'Solo se adjuntan documentos a solicitudes pendientes',
      );
    mkdirSync(CARPETA_DOCS, { recursive: true });
    const nombre = `solicitud-${idSolicitud}${ext}`;
    writeFileSync(join(CARPETA_DOCS, nombre), a.buffer);
    await this.prisma.solicitud_tutoria.update({
      where: { id_solicitud: idSolicitud },
      data: { documento_apoyo: nombre },
    });
  }

  /** El documento lo ven el estudiante dueño, el tutor de la franja y el coordinador. */
  async documento(u: UsuarioActual, idSolicitud: number) {
    const s = await this.prisma.solicitud_tutoria.findUnique({
      where: { id_solicitud: idSolicitud },
      include: { horario_tutor: true },
    });
    const puede =
      s &&
      (u.rol === 'Coordinador' ||
        (u.rol === 'Estudiante' && s.id_estudiante === u.id_usuario) ||
        (u.rol === 'Tutor' && s.horario_tutor.id_tutor === u.id_usuario));
    if (!puede) throw new NotFoundException('La solicitud no existe.');
    const ruta = s.documento_apoyo ? join(CARPETA_DOCS, s.documento_apoyo) : '';
    if (!ruta || !existsSync(ruta))
      throw new NotFoundException('La solicitud no tiene documento de apoyo.');
    const ext = extname(ruta).toLowerCase();
    return new StreamableFile(createReadStream(ruta), {
      type: TIPOS_DOC[ext] ?? 'application/octet-stream',
      disposition: `inline; filename="documento-solicitud-${idSolicitud}${ext}"`,
    });
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
  @Post(':id/documento')
  @Roles('Estudiante')
  @HttpCode(204)
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAX_DOC + 1 } }),
  )
  subirDocumento(
    @Usuario() u: UsuarioActual,
    @Param('id') i: string,
    @UploadedFile() archivo?: ArchivoSubido,
  ) {
    return this.s.subirDocumento(u.id_usuario, id(i), archivo);
  }
  @Get(':id/documento') documento(
    @Usuario() u: UsuarioActual,
    @Param('id') i: string,
  ) {
    return this.s.documento(u, id(i));
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
