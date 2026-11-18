import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ES_PUBLICA, ROLES, Rol, UsuarioActual } from './decorators';

/** Guard global: toda ruta exige sesión salvo las marcadas con @Publica(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    const publica = this.reflector.getAllAndOverride<boolean>(ES_PUBLICA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (publica) return true;
    return super.canActivate(ctx);
  }

  handleRequest<T>(err: unknown, user: T): T {
    if (err) throw err;
    if (!user) throw new UnauthorizedException('Inicia sesión para continuar.');
    return user;
  }
}

/** Guard global: si la ruta tiene @Roles(...), el rol del usuario debe coincidir. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[]>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;
    const user: UsuarioActual | undefined = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.rol)) {
      throw new ForbiddenException('No tienes permiso para realizar esta acción.');
    }
    return true;
  }
}
