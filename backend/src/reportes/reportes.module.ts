import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { IsIn, IsInt, IsOptional, Matches } from 'class-validator';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import {
  ahora,
  fechaDesdeTexto,
  textoFecha,
  textoHora,
} from '../common/fecha.util';
import {
  INCLUDE_SOLICITUD,
  INCLUDE_TUTORIA,
  notificar,
} from '../common/mapeos';
import { FECHA, id } from '../common/validacion';
import { Roles, Usuario, type UsuarioActual } from '../auth/decorators';

const TIPOS = [
  'Tutorías realizadas',
  'Asistencia estudiantil',
  'Progreso académico',
  'Demanda por asignatura',
  'Gestión de solicitudes',
] as const;
type Tipo = (typeof TIPOS)[number];

export class FiltrosDto {
  @IsIn(TIPOS, { message: 'Tipo de reporte inválido' }) tipo!: Tipo;
  @Matches(FECHA, { message: 'Fecha inicial inválida' }) fecha_desde!: string;
  @Matches(FECHA, { message: 'Fecha final inválida' }) fecha_hasta!: string;
  @IsOptional() @IsInt() id_tutor?: number;
  @IsOptional() @IsInt() id_asignatura?: number;
  @IsOptional()
  @IsIn(['Programada', 'Realizada', 'Cancelada'], {
    message: 'Estado inválido',
  })
  estado_filtro?: string;
}

export class GenerarDto extends FiltrosDto {
  @IsIn(['PDF', 'XLSX'], { message: 'Formato inválido' }) formato!:
    'PDF' | 'XLSX';
}

interface Datos {
  titulo: string;
  total_tutorias: number;
  tasa_asistencia: number;
  columnas: string[];
  filas: (string | number)[][];
}

const dmy = (d: Date) => textoFecha(d).split('-').reverse().join('/');
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** M7 Reportes (RF-11): métricas, vista previa, exportación PDF/XLSX e historial (regla 3.29.3). */
@Injectable()
export class ReportesService {
  constructor(private prisma: PrismaService) {}

  async metricas() {
    const momento = ahora();
    const [
      usuarios,
      sesiones,
      pendientes,
      tutorias,
      seguimientos,
      demanda,
      asignaturas,
    ] = await Promise.all([
      this.prisma.usuario.findMany({ select: { rol: true, activo: true } }),
      this.prisma.sesion.count({
        where: { fecha_cierre: null, fecha_expiracion: { gt: momento } },
      }),
      this.prisma.solicitud_tutoria.count({ where: { estado: 'Pendiente' } }),
      this.prisma.tutoria.groupBy({ by: ['estado'], _count: true }),
      this.prisma.seguimiento.findMany({ select: { asistio: true } }),
      this.prisma.solicitud_tutoria.groupBy({
        by: ['id_asignatura'],
        _count: true,
      }),
      this.prisma.asignatura.findMany(),
    ]);
    const porRol = { Estudiante: 0, Tutor: 0, Coordinador: 0 } as Record<
      string,
      number
    >;
    usuarios.forEach((u) => (porRol[u.rol] = (porRol[u.rol] ?? 0) + 1));
    const porEstado = { Programada: 0, Realizada: 0, Cancelada: 0 } as Record<
      string,
      number
    >;
    tutorias.forEach((t) => (porEstado[t.estado] = t._count));
    return {
      total_usuarios: usuarios.length,
      usuarios_por_rol: porRol,
      usuarios_activos: usuarios.filter((u) => u.activo).length,
      sesiones_activas: sesiones,
      solicitudes_pendientes: pendientes,
      tutorias_por_estado: porEstado,
      demanda_por_asignatura: demanda
        .map((d) => ({
          asignatura:
            asignaturas.find((a) => a.id_asignatura === d.id_asignatura)
              ?.nombre ?? '—',
          total: d._count,
        }))
        .sort((a, b) => b.total - a.total),
      tasa_asistencia: pct(
        seguimientos.filter((s) => s.asistio).length,
        seguimientos.length,
      ),
    };
  }

  /** Arma las filas del reporte según su tipo. La vista previa y los archivos usan esta misma función. */
  async datos(f: FiltrosDto): Promise<Datos> {
    const rangoFranja = {
      fecha: {
        gte: fechaDesdeTexto(f.fecha_desde),
        lte: fechaDesdeTexto(f.fecha_hasta),
      },
      ...(f.id_tutor ? { id_tutor: f.id_tutor } : {}),
    };
    const tutorias = await this.prisma.tutoria.findMany({
      where: {
        horario_tutor: rangoFranja,
        ...(f.id_asignatura
          ? { solicitud_tutoria: { id_asignatura: f.id_asignatura } }
          : {}),
        ...(f.estado_filtro ? { estado: f.estado_filtro } : {}),
      },
      include: INCLUDE_TUTORIA,
      orderBy: [
        { horario_tutor: { fecha: 'asc' } },
        { horario_tutor: { hora_inicio: 'asc' } },
      ],
    });
    const conSeg = tutorias.filter((t) => t.seguimiento);
    const base = {
      titulo: f.tipo,
      total_tutorias: tutorias.length,
      tasa_asistencia: pct(
        conSeg.filter((t) => t.seguimiento!.asistio).length,
        conSeg.length,
      ),
    };
    const est = (t: (typeof tutorias)[number]) =>
      t.solicitud_tutoria.estudiante.usuario;
    const tutor = (t: (typeof tutorias)[number]) =>
      t.horario_tutor.tutor.usuario.nombre_completo;

    switch (f.tipo) {
      case 'Tutorías realizadas':
        return {
          ...base,
          columnas: [
            'Fecha',
            'Hora',
            'Estudiante',
            'Tutor',
            'Asignatura',
            'Lugar',
            'Estado',
          ],
          filas: tutorias.map((t) => [
            dmy(t.horario_tutor.fecha),
            `${textoHora(t.horario_tutor.hora_inicio)} – ${textoHora(t.horario_tutor.hora_fin)}`,
            est(t).nombre_completo,
            tutor(t),
            t.solicitud_tutoria.asignatura.nombre,
            t.lugar ?? '',
            t.estado,
          ]),
        };

      case 'Asistencia estudiantil': {
        const grupos = new Map<
          number,
          { nombre: string; carnet: string; total: number; asistio: number }
        >();
        conSeg.forEach((t) => {
          const u = est(t);
          const g = grupos.get(u.id_usuario) ?? {
            nombre: u.nombre_completo,
            carnet: u.identificacion,
            total: 0,
            asistio: 0,
          };
          g.total++;
          if (t.seguimiento!.asistio) g.asistio++;
          grupos.set(u.id_usuario, g);
        });
        return {
          ...base,
          columnas: [
            'Estudiante',
            'Carnet',
            'Tutorías con seguimiento',
            'Asistencias',
            'Inasistencias',
            '% asistencia',
          ],
          filas: [...grupos.values()]
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
            .map((g) => [
              g.nombre,
              g.carnet,
              g.total,
              g.asistio,
              g.total - g.asistio,
              `${pct(g.asistio, g.total)}%`,
            ]),
        };
      }

      case 'Progreso académico':
        return {
          ...base,
          columnas: [
            'Fecha',
            'Estudiante',
            'Asignatura',
            'Tutor',
            'Asistió',
            'Nivel',
            'Observaciones',
          ],
          filas: conSeg.map((t) => [
            dmy(t.horario_tutor.fecha),
            est(t).nombre_completo,
            t.solicitud_tutoria.asignatura.nombre,
            tutor(t),
            t.seguimiento!.asistio ? 'Sí' : 'No',
            t.seguimiento!.nivel_progreso ?? '—',
            t.seguimiento!.observaciones,
          ]),
        };

      default: {
        // Demanda por asignatura / Gestión de solicitudes: se basan en las solicitudes
        const solicitudes = await this.prisma.solicitud_tutoria.findMany({
          where: {
            horario_tutor: rangoFranja,
            ...(f.id_asignatura ? { id_asignatura: f.id_asignatura } : {}),
          },
          include: INCLUDE_SOLICITUD,
          orderBy: { fecha_solicitud: 'asc' },
        });
        if (f.tipo === 'Gestión de solicitudes') {
          return {
            ...base,
            columnas: [
              'Fecha solicitud',
              'Estudiante',
              'Asignatura',
              'Tutor',
              'Estado',
              'Fecha respuesta',
              'Motivo rechazo',
            ],
            filas: solicitudes.map((s) => [
              dmy(s.fecha_solicitud),
              s.estudiante.usuario.nombre_completo,
              s.asignatura.nombre,
              s.horario_tutor.tutor.usuario.nombre_completo,
              s.estado,
              s.fecha_respuesta ? dmy(s.fecha_respuesta) : '—',
              s.motivo_rechazo ?? '',
            ]),
          };
        }
        const grupos = new Map<string, number[]>();
        solicitudes.forEach((s) => {
          const g = grupos.get(s.asignatura.nombre) ?? [0, 0, 0, 0, 0];
          g[0]++;
          g[s.estado === 'Aprobada' ? 1 : s.estado === 'Rechazada' ? 2 : 3]++;
          if (s.tutoria?.estado === 'Realizada') g[4]++;
          grupos.set(s.asignatura.nombre, g);
        });
        return {
          ...base,
          columnas: [
            'Asignatura',
            'Solicitudes',
            'Aprobadas',
            'Rechazadas',
            'Pendientes',
            'Tutorías realizadas',
          ],
          filas: [...grupos.entries()]
            .sort((a, b) => b[1][0] - a[1][0])
            .map(([n, g]) => [n, ...g]),
        };
      }
    }
  }

  async historial() {
    const lista = await this.prisma.reporte.findMany({
      include: {
        coordinador: true,
        tutor: { include: { usuario: true } },
        asignatura: true,
      },
      orderBy: { fecha_generacion: 'desc' },
      take: 20,
    });
    return lista.map((r) => ({
      id_reporte: r.id_reporte,
      tipo: r.tipo,
      fecha_desde: textoFecha(r.fecha_desde),
      fecha_hasta: textoFecha(r.fecha_hasta),
      id_tutor: r.id_tutor,
      tutor: r.tutor?.usuario.nombre_completo ?? null,
      id_asignatura: r.id_asignatura,
      asignatura: r.asignatura?.nombre ?? null,
      estado_filtro: r.estado_filtro,
      formato: r.formato,
      fecha_generacion: r.fecha_generacion,
      responsable: r.coordinador.nombre_completo,
    }));
  }

  /** Genera el archivo y lo registra en el historial. */
  async generar(d: GenerarDto, u: UsuarioActual) {
    const archivo = await this.archivo(d, d.formato);
    await this.prisma.$transaction(async (tx) => {
      await tx.reporte.create({
        data: {
          id_coordinador: u.id_usuario,
          tipo: d.tipo,
          fecha_desde: fechaDesdeTexto(d.fecha_desde),
          fecha_hasta: fechaDesdeTexto(d.fecha_hasta),
          id_tutor: d.id_tutor ?? null,
          id_asignatura: d.id_asignatura ?? null,
          estado_filtro: d.estado_filtro ?? null,
          formato: d.formato,
          fecha_generacion: ahora(),
        },
      });
      await notificar(
        tx,
        u.id_usuario,
        'Reporte',
        'Reporte generado',
        `El reporte de ${d.tipo} (${d.formato}) está listo.`,
      );
    });
    return archivo;
  }

  /** Vuelve a generar un reporte del historial con sus filtros guardados. */
  async desdeHistorial(idReporte: number) {
    const r = await this.prisma.reporte.findUnique({
      where: { id_reporte: idReporte },
    });
    if (!r) throw new NotFoundException('El reporte no existe.');
    const f: FiltrosDto = {
      tipo: r.tipo as Tipo,
      fecha_desde: textoFecha(r.fecha_desde),
      fecha_hasta: textoFecha(r.fecha_hasta),
      id_tutor: r.id_tutor ?? undefined,
      id_asignatura: r.id_asignatura ?? undefined,
      estado_filtro: r.estado_filtro ?? undefined,
    };
    return this.archivo(f, r.formato as 'PDF' | 'XLSX');
  }

  private async archivo(f: FiltrosDto, formato: 'PDF' | 'XLSX') {
    const datos = await this.datos(f);
    const slug = f.tipo
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '-');
    const nombre = `reporte-${slug}-${textoFecha(ahora())}.${formato === 'PDF' ? 'pdf' : 'xlsx'}`;
    const subtitulo = `Del ${dmy(fechaDesdeTexto(f.fecha_desde))} al ${dmy(fechaDesdeTexto(f.fecha_hasta))} · Generado el ${dmy(ahora())}`;
    const buffer =
      formato === 'PDF'
        ? await this.pdf(datos, subtitulo)
        : await this.xlsx(datos, subtitulo);
    const tipo =
      formato === 'PDF'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return { buffer, nombre, tipo };
  }

  private pdf(d: Datos, subtitulo: string): Promise<Buffer> {
    return new Promise((resolve) => {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 40,
      });
      const partes: Buffer[] = [];
      doc.on('data', (c: Buffer) => partes.push(c));
      doc.on('end', () => resolve(Buffer.concat(partes)));

      const morado = '#4f378a';
      doc
        .fillColor(morado)
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('SIGTAU', { continued: true })
        .fillColor('#49454f')
        .fontSize(11)
        .font('Helvetica')
        .text(
          '  Sistema Integral de Gestión de Tutorías Académicas Universitarias',
        );
      doc
        .moveDown(0.5)
        .fillColor('#1d1b20')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(d.titulo);
      doc.fontSize(9).font('Helvetica').fillColor('#49454f').text(subtitulo);
      doc
        .moveDown(0.5)
        .fontSize(10)
        .fillColor('#1d1b20')
        .text(
          `Total de tutorías: ${d.total_tutorias}     Tasa de asistencia: ${d.tasa_asistencia}%     Filas: ${d.filas.length}`,
        );
      doc.moveDown(0.8);

      const ancho = doc.page.width - 80;
      const col = ancho / d.columnas.length;
      const fila = (valores: (string | number)[], encabezado: boolean) => {
        const alto = Math.max(
          18,
          ...valores.map(
            (v) =>
              doc.fontSize(8.5).heightOfString(String(v), { width: col - 8 }) +
              8,
          ),
        );
        if (doc.y + alto > doc.page.height - 40) doc.addPage();
        const y = doc.y;
        if (encabezado) doc.rect(40, y, ancho, alto).fill(morado);
        else
          doc
            .moveTo(40, y + alto)
            .lineTo(40 + ancho, y + alto)
            .strokeColor('#e2dae6')
            .lineWidth(0.5)
            .stroke();
        valores.forEach((v, i) => {
          doc
            .fillColor(encabezado ? '#ffffff' : '#1d1b20')
            .font(encabezado ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(8.5)
            .text(String(v), 44 + i * col, y + 4, { width: col - 8 });
        });
        doc.y = y + alto;
      };
      fila(d.columnas, true);
      if (d.filas.length === 0)
        doc
          .moveDown()
          .fontSize(10)
          .fillColor('#49454f')
          .text('No hay datos para los filtros seleccionados.', 40);
      d.filas.forEach((r) => fila(r, false));
      doc.end();
    });
  }

  private async xlsx(d: Datos, subtitulo: string): Promise<Buffer> {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'SIGTAU';
    const hoja = libro.addWorksheet(d.titulo.slice(0, 31));
    hoja.addRow([`SIGTAU — ${d.titulo}`]).font = {
      bold: true,
      size: 14,
      color: { argb: 'FF4F378A' },
    };
    hoja.addRow([subtitulo]).font = {
      italic: true,
      color: { argb: 'FF49454F' },
    };
    hoja.addRow([
      `Total de tutorías: ${d.total_tutorias}`,
      `Tasa de asistencia: ${d.tasa_asistencia}%`,
    ]);
    hoja.addRow([]);
    const enc = hoja.addRow(d.columnas);
    enc.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F378A' },
      };
    });
    d.filas.forEach((f) => hoja.addRow(f));
    hoja.columns.forEach((c, i) => {
      const largo = Math.max(
        d.columnas[i]?.length ?? 10,
        ...d.filas.map((f) => String(f[i] ?? '').length),
      );
      c.width = Math.min(60, Math.max(12, largo + 2));
    });
    hoja.views = [{ state: 'frozen', ySplit: 5 }];
    return Buffer.from(await libro.xlsx.writeBuffer());
  }
}

@Controller('reportes')
@Roles('Coordinador')
export class ReportesController {
  constructor(private s: ReportesService) {}

  @Get('metricas') metricas() {
    return this.s.metricas();
  }
  @Get() historial() {
    return this.s.historial();
  }
  @Post('vista-previa') @HttpCode(200) vistaPrevia(@Body() f: FiltrosDto) {
    return this.s.datos(f);
  }

  @Post()
  @HttpCode(200)
  async generar(
    @Body() d: GenerarDto,
    @Usuario() u: UsuarioActual,
    @Res() res: Response,
  ) {
    enviar(res, await this.s.generar(d, u));
  }

  @Get(':id/archivo')
  async archivo(@Param('id') i: string, @Res() res: Response) {
    enviar(res, await this.s.desdeHistorial(id(i)));
  }
}

function enviar(
  res: Response,
  a: { buffer: Buffer; nombre: string; tipo: string },
) {
  res.set({
    'Content-Type': a.tipo,
    'Content-Disposition': `attachment; filename="${a.nombre}"`,
    'Access-Control-Expose-Headers': 'Content-Disposition',
  });
  res.send(a.buffer);
}

@Module({ controllers: [ReportesController], providers: [ReportesService] })
export class ReportesModule {}
