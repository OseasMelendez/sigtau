import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

/**
 * Un módulo de NestJS por cada módulo del sistema (Tabla 8 del avance):
 *   M1 AuthModule            (listo)
 *   M2 SolicitudesModule     M3 HorariosModule      M4 TutoriasModule
 *   M5 SeguimientoModule     M6 NotificacionesModule
 *   M7 ReportesModule        M8 UsuariosModule
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule],
})
export class AppModule {}
