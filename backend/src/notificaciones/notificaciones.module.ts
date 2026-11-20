import {
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { id } from '../common/validacion';
import { Usuario, type UsuarioActual } from '../auth/decorators';

/** M6 Notificaciones (RF-10). Se crean en cada evento con notificar() de common/mapeos.ts. */
@Injectable()
export class NotificacionesService {
  constructor(private prisma: PrismaService) {}

  mias(idUsuario: number) {
    return this.prisma.notificacion.findMany({
      where: { id_usuario: idUsuario },
      orderBy: { fecha_envio: 'desc' },
      take: 50,
      select: {
        id_notificacion: true,
        tipo: true,
        titulo: true,
        mensaje: true,
        leida: true,
        fecha_envio: true,
      },
    });
  }

  async marcarLeida(idUsuario: number, idNotificacion: number) {
    const r = await this.prisma.notificacion.updateMany({
      where: { id_notificacion: idNotificacion, id_usuario: idUsuario },
      data: { leida: true },
    });
    if (!r.count) throw new NotFoundException('La notificación no existe.');
  }

  async marcarTodas(idUsuario: number) {
    await this.prisma.notificacion.updateMany({
      where: { id_usuario: idUsuario, leida: false },
      data: { leida: true },
    });
  }
}

@Controller('notificaciones')
export class NotificacionesController {
  constructor(private s: NotificacionesService) {}

  @Get() mias(@Usuario() u: UsuarioActual) {
    return this.s.mias(u.id_usuario);
  }
  @Patch('leidas') @HttpCode(204) todas(@Usuario() u: UsuarioActual) {
    return this.s.marcarTodas(u.id_usuario);
  }
  @Patch(':id/leida') @HttpCode(204) leida(
    @Usuario() u: UsuarioActual,
    @Param('id') i: string,
  ) {
    return this.s.marcarLeida(u.id_usuario, id(i));
  }
}

@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
})
export class NotificacionesModule {}
