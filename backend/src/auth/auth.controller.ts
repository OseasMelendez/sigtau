import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Publica, Usuario, type UsuarioActual } from './decorators';
import { COOKIE_SESION } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /** RF-01. El token viaja en una cookie httpOnly + SameSite (RNF-02). */
  @Publica()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auth.login(dto.usuario, dto.contrasena);
    res.cookie(COOKIE_SESION, r.token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: r.expiraEnHoras * 60 * 60 * 1000,
    });
    return { usuario: r.usuario };
  }

  /** RF-02 */
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Usuario() u: UsuarioActual,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(u.id_sesion);
    res.clearCookie(COOKIE_SESION);
    return { message: 'Sesión cerrada' };
  }

  /** Usuario de la sesión actual (el frontend lo llama al cargar). */
  @Get('me')
  me(@Usuario() u: UsuarioActual) {
    return this.auth.perfil(u.id_usuario);
  }
}
