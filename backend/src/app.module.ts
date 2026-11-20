import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { HorariosModule } from './horarios/horarios.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { TutoriasModule } from './tutorias/tutorias.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ReportesModule } from './reportes/reportes.module';

/**
 * Un módulo de NestJS por cada módulo del sistema (Tabla 8 del avance):
 *   M1 AuthModule            (listo)
 *   M2 SolicitudesModule     M3 HorariosModule      M4 TutoriasModule
 *   M5 SeguimientoModule     M6 NotificacionesModule
 *   M7 ReportesModule        M8 UsuariosModule
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CatalogosModule,
    HorariosModule,
    SolicitudesModule,
    TutoriasModule,
    NotificacionesModule,
    UsuariosModule,
    ReportesModule,
  ],
})
export class AppModule {}
