import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ahora, sumarMinutos } from '../common/fecha.util';
import { Rol } from './decorators';

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  /** RF-01: iniciar sesión con usuario o correo institucional. */
  async login(usuarioOCorreo: string, contrasena: string) {
    const valor = usuarioOCorreo.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findFirst({
      where: { OR: [{ nombre_usuario: valor }, { correo: valor }] },
    });

    // Mismo mensaje si el usuario no existe o la contraseña es incorrecta (CP-01)
    if (!usuario) throw new UnauthorizedException('Credenciales incorrectas');

    if (!usuario.activo) {
      throw new ForbiddenException(
        'Tu cuenta está desactivada. Contacta al coordinador académico.',
      );
    }

    const momento = ahora();
    if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > momento) {
      const minutos = Math.ceil(
        (usuario.bloqueado_hasta.getTime() - momento.getTime()) / 60000,
      );
      throw new ForbiddenException(
        `Cuenta bloqueada por intentos fallidos. Intenta de nuevo en ${minutos} min.`,
      );
    }

    const valida = await bcrypt.compare(contrasena, usuario.contrasena_hash);
    if (!valida) {
      const intentos = usuario.intentos_fallidos + 1;
      const bloquear = intentos >= MAX_INTENTOS;
      await this.prisma.usuario.update({
        where: { id_usuario: usuario.id_usuario },
        data: {
          intentos_fallidos: bloquear ? 0 : intentos,
          bloqueado_hasta: bloquear ? sumarMinutos(momento, MINUTOS_BLOQUEO) : null,
        },
      });
      if (bloquear) {
        throw new ForbiddenException(
          `Cuenta bloqueada por ${MINUTOS_BLOQUEO} min tras ${MAX_INTENTOS} intentos fallidos.`,
        );
      }
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // Regla 3.4: una sola sesión activa por cuenta. El nuevo inicio de sesión
    // cierra la anterior (el índice uq_sesion_activa lo garantiza en la BD).
    const horas = Number(process.env.JWT_EXPIRES_HOURS ?? 8);
    const expiracion = sumarMinutos(momento, horas * 60);

    const { token, sesion } = await this.prisma.$transaction(async (tx) => {
      await tx.sesion.updateMany({
        where: { id_usuario: usuario.id_usuario, fecha_cierre: null },
        data: { fecha_cierre: momento },
      });
      // Se crea la sesión con un hash temporal para obtener su id, y luego
      // se guarda el hash del token real que incluye ese id.
      const temporal = await tx.sesion.create({
        data: {
          id_usuario: usuario.id_usuario,
          token_hash: hashToken(`${usuario.id_usuario}-${Date.now()}-${Math.random()}`),
          fecha_inicio: momento,
          fecha_expiracion: expiracion,
        },
      });
      const token = await this.jwt.signAsync(
        { sub: usuario.id_usuario, rol: usuario.rol, sid: temporal.id_sesion },
        { expiresIn: `${horas}h` },
      );
      const sesion = await tx.sesion.update({
        where: { id_sesion: temporal.id_sesion },
        data: { token_hash: hashToken(token) },
      });
      await tx.usuario.update({
        where: { id_usuario: usuario.id_usuario },
        data: { intentos_fallidos: 0, bloqueado_hasta: null, ultimo_acceso: momento },
      });
      return { token, sesion };
    });

    return {
      token,
      expiraEnHoras: horas,
      sesion: sesion.id_sesion,
      usuario: await this.perfil(usuario.id_usuario),
    };
  }

  /** RF-02: cerrar sesión. El token deja de ser válido aunque no haya expirado. */
  async logout(idSesion: number) {
    await this.prisma.sesion.update({
      where: { id_sesion: idSesion },
      data: { fecha_cierre: ahora() },
    });
  }

  /** Verifica que la sesión del token siga abierta y vigente. */
  async validarSesion(idSesion: number, token: string) {
    const sesion = await this.prisma.sesion.findUnique({
      where: { id_sesion: idSesion },
      include: { usuario: true },
    });
    if (
      !sesion ||
      sesion.fecha_cierre ||
      sesion.fecha_expiracion <= ahora() ||
      sesion.token_hash !== hashToken(token) ||
      !sesion.usuario.activo
    ) {
      return null;
    }
    return {
      id_usuario: sesion.usuario.id_usuario,
      rol: sesion.usuario.rol as Rol,
      nombre_completo: sesion.usuario.nombre_completo,
      id_sesion: sesion.id_sesion,
    };
  }

  /** Datos del usuario para el frontend, sin la contraseña. */
  async perfil(idUsuario: number) {
    const u = await this.prisma.usuario.findUniqueOrThrow({
      where: { id_usuario: idUsuario },
      include: {
        estudiante: { include: { carrera: true } },
        tutor: {
          include: { tutor_asignatura: { include: { asignatura: true } } },
        },
      },
    });
    return {
      id_usuario: u.id_usuario,
      nombre_usuario: u.nombre_usuario,
      nombre_completo: u.nombre_completo,
      correo: u.correo,
      rol: u.rol as Rol,
      debe_cambiar_contrasena: u.debe_cambiar_contrasena,
      estudiante: u.estudiante
        ? { carrera: u.estudiante.carrera.nombre, ciclo: u.estudiante.ciclo }
        : null,
      tutor: u.tutor
        ? {
            especialidad: u.tutor.especialidad,
            asignaturas: u.tutor.tutor_asignatura.map((ta) => ta.asignatura.nombre),
          }
        : null,
    };
  }
}
