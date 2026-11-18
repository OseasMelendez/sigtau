import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { AuthService } from './auth.service';

export const COOKIE_SESION = 'sigtau_token';

const desdeCookie = (req: Request): string | null =>
  req?.cookies?.[COOKIE_SESION] ?? null;

/**
 * Lee el JWT de la cookie httpOnly (o del encabezado Authorization para
 * pruebas con Postman) y comprueba en la tabla sesion que no esté cerrada.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private auth: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        desdeCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: process.env.JWT_SECRET!,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: number; sid: number }) {
    const token =
      desdeCookie(req) ?? ExtractJwt.fromAuthHeaderAsBearerToken()(req)!;
    const usuario = await this.auth.validarSesion(payload.sid, token);
    if (!usuario) {
      throw new UnauthorizedException('Tu sesión expiró. Inicia sesión de nuevo.');
    }
    return usuario;
  }
}
