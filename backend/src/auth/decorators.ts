import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export type Rol = 'Estudiante' | 'Tutor' | 'Coordinador';

/** Datos del usuario autenticado que quedan en req.user. */
export interface UsuarioActual {
  id_usuario: number;
  rol: Rol;
  nombre_completo: string;
  id_sesion: number;
}

/** Marca una ruta como pública (no exige sesión). */
export const ES_PUBLICA = 'esPublica';
export const Publica = () => SetMetadata(ES_PUBLICA, true);

/** Restringe una ruta a uno o más roles. Ej.: @Roles('Tutor') */
export const ROLES = 'roles';
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);

/** Inyecta el usuario autenticado. Ej.: metodo(@Usuario() u: UsuarioActual) */
export const Usuario = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioActual =>
    ctx.switchToHttp().getRequest().user,
);
