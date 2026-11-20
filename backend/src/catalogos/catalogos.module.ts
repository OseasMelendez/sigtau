import {
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { fechaDesdeTexto, textoFecha } from '../common/fecha.util';
import { ahora } from '../common/fecha.util';
import { mapAsignatura, mapFranja } from '../common/mapeos';
import { id, rango } from '../common/validacion';

/** Hoy en El Salvador como Date de columna DATE. */
const hoy = () => fechaDesdeTexto(textoFecha(ahora()));

@Injectable()
export class CatalogosService {
  constructor(private prisma: PrismaService) {}

  async asignaturas() {
    const lista = await this.prisma.asignatura.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' },
    });
    return lista.map(mapAsignatura);
  }

  async catalogos() {
    const [facultades, carreras, asignaturas] = await Promise.all([
      this.prisma.facultad.findMany({ orderBy: { nombre: 'asc' } }),
      this.prisma.carrera.findMany({ orderBy: { nombre: 'asc' } }),
      this.asignaturas(),
    ]);
    return { facultades, carreras, asignaturas };
  }

  /** Tutores activos que imparten la asignatura, con su disponibilidad desde hoy. */
  async tutoresPorAsignatura(idAsignatura: number) {
    const tutores = await this.prisma.tutor.findMany({
      where: {
        usuario: { activo: true },
        tutor_asignatura: { some: { id_asignatura: idAsignatura } },
      },
      include: {
        usuario: true,
        horario_tutor: {
          where: { estado: 'Disponible', fecha: { gte: hoy() } },
        },
      },
      orderBy: { usuario: { nombre_completo: 'asc' } },
    });
    return tutores.map((t) => ({
      id_usuario: t.id_usuario,
      nombre_completo: t.usuario.nombre_completo,
      especialidad: t.especialidad,
      franjas_disponibles: t.horario_tutor.length,
      dias_disponibles: [
        ...new Set(t.horario_tutor.map((h) => h.fecha.getUTCDay() || 7)),
      ].sort(),
    }));
  }

  async tutor(idTutor: number) {
    const t = await this.prisma.tutor.findFirst({
      where: { id_usuario: idTutor, usuario: { activo: true } },
      include: {
        usuario: true,
        tutor_asignatura: { include: { asignatura: true } },
      },
    });
    if (!t) throw new NotFoundException('El tutor no existe o está inactivo.');
    return {
      id_usuario: t.id_usuario,
      nombre_completo: t.usuario.nombre_completo,
      especialidad: t.especialidad,
      biografia: t.biografia,
      telefono_contacto: t.telefono_contacto,
      asignaturas: t.tutor_asignatura.map((ta) => mapAsignatura(ta.asignatura)),
    };
  }

  async franjas(idTutor: number, desde: string, hasta: string) {
    const lista = await this.prisma.horario_tutor.findMany({
      where: {
        id_tutor: idTutor,
        fecha: { gte: fechaDesdeTexto(desde), lte: fechaDesdeTexto(hasta) },
      },
      orderBy: [{ fecha: 'asc' }, { hora_inicio: 'asc' }],
    });
    return lista.map(mapFranja);
  }
}

/** Catálogos y consulta de tutores: cualquier usuario autenticado. */
@Controller()
export class CatalogosController {
  constructor(private s: CatalogosService) {}

  @Get('asignaturas') asignaturas() {
    return this.s.asignaturas();
  }
  @Get('catalogos') catalogos() {
    return this.s.catalogos();
  }
  @Get('tutores') tutores(@Query('asignatura') a: string) {
    return this.s.tutoresPorAsignatura(id(a));
  }
  @Get('tutores/:id') tutor(@Param('id') t: string) {
    return this.s.tutor(id(t));
  }
  @Get('tutores/:id/franjas')
  franjas(
    @Param('id') t: string,
    @Query('desde') d?: string,
    @Query('hasta') h?: string,
  ) {
    const r = rango(d, h);
    return this.s.franjas(id(t), r.desde, r.hasta);
  }
}

@Module({ controllers: [CatalogosController], providers: [CatalogosService] })
export class CatalogosModule {}
