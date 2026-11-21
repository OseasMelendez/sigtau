import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Type, Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ahora } from '../common/fecha.util';
import { mapAsignatura } from '../common/mapeos';
import { id } from '../common/validacion';
import { Roles, Usuario, type UsuarioActual } from '../auth/decorators';

const recortar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

class DatosEstudianteDto {
  @IsInt({ message: 'Selecciona la carrera' }) id_carrera!: number;
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'El ciclo va de 1 a 12' })
  @Max(12, { message: 'El ciclo va de 1 a 12' })
  ciclo?: number | null;
}

class DatosTutorDto {
  @IsInt({ message: 'Selecciona la facultad' }) id_facultad!: number;
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(20, { message: 'El título no puede superar 20 caracteres' })
  titulo?: string | null;
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(100, { message: 'El departamento no puede superar 100 caracteres' })
  departamento?: string | null;
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'La especialidad es obligatoria' })
  @MaxLength(100)
  especialidad!: string;
  @IsOptional() @IsString() @MaxLength(15) telefono_contacto?: string | null;
  @IsOptional() @IsString() @MaxLength(500) biografia?: string | null;
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecciona al menos una asignatura' })
  @IsInt({ each: true })
  asignaturas!: number[];
}

export class UsuarioDto {
  @IsIn(['Estudiante', 'Tutor'], {
    message: 'Solo se registran estudiantes y tutores',
  })
  rol!: 'Estudiante' | 'Tutor';
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100)
  nombre_completo!: string;
  @Transform(recortar)
  @Matches(/^[a-z0-9._-]{3,30}$/, {
    message:
      'Nombre de usuario: de 3 a 30 caracteres (letras, números, punto o guion)',
  })
  nombre_usuario!: string;
  @Transform(recortar)
  @IsString()
  @IsNotEmpty({ message: 'La identificación es obligatoria' })
  @MaxLength(20)
  identificacion!: string;
  @Transform(recortar)
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  @MaxLength(100)
  correo!: string;
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72)
  contrasena?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => DatosEstudianteDto)
  estudiante?: DatosEstudianteDto;
  @IsOptional()
  @ValidateNested()
  @Type(() => DatosTutorDto)
  tutor?: DatosTutorDto;
}

export class ActivoDto {
  @IsBoolean() activo!: boolean;
}

const INCLUDE_USUARIO = {
  estudiante: { include: { carrera: true } },
  tutor: { include: { tutor_asignatura: { include: { asignatura: true } } } },
} satisfies Prisma.usuarioInclude;

function mapUsuario(
  u: Prisma.usuarioGetPayload<{ include: typeof INCLUDE_USUARIO }>,
) {
  return {
    id_usuario: u.id_usuario,
    nombre_usuario: u.nombre_usuario,
    nombre_completo: u.nombre_completo,
    identificacion: u.identificacion,
    correo: u.correo,
    rol: u.rol,
    activo: u.activo,
    ultimo_acceso: u.ultimo_acceso,
    fecha_registro: u.fecha_registro,
    estudiante: u.estudiante
      ? {
          id_carrera: u.estudiante.id_carrera,
          carrera: u.estudiante.carrera.nombre,
          ciclo: u.estudiante.ciclo,
        }
      : null,
    tutor: u.tutor
      ? {
          id_facultad: u.tutor.id_facultad,
          titulo: u.tutor.titulo,
          departamento: u.tutor.departamento,
          especialidad: u.tutor.especialidad,
          telefono_contacto: u.tutor.telefono_contacto,
          biografia: u.tutor.biografia,
          asignaturas: u.tutor.tutor_asignatura.map((ta) =>
            mapAsignatura(ta.asignatura),
          ),
        }
      : null,
  };
}

/** M8 Gestión de usuarios (RF-12): registrar, editar, activar/desactivar. Nunca se eliminan. */
@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  async listar(f: { rol?: string; q?: string; activo?: string }) {
    const q = f.q?.trim();
    const lista = await this.prisma.usuario.findMany({
      where: {
        ...(f.rol ? { rol: f.rol } : {}),
        ...(f.activo === 'true' || f.activo === 'false'
          ? { activo: f.activo === 'true' }
          : {}),
        ...(q
          ? {
              OR: [
                'nombre_completo',
                'nombre_usuario',
                'correo',
                'identificacion',
              ].map((c) => ({ [c]: { contains: q, mode: 'insensitive' } })),
            }
          : {}),
      },
      include: INCLUDE_USUARIO,
      orderBy: { nombre_completo: 'asc' },
    });
    return lista.map(mapUsuario);
  }

  private validarRol(d: UsuarioDto) {
    if (d.rol === 'Estudiante' && !d.estudiante)
      throw new BadRequestException(
        'Faltan los datos académicos del estudiante',
      );
    if (d.rol === 'Tutor' && !d.tutor)
      throw new BadRequestException('Faltan los datos del tutor');
  }

  private datosBase(d: UsuarioDto) {
    return {
      nombre_completo: d.nombre_completo,
      nombre_usuario: d.nombre_usuario.toLowerCase(),
      identificacion: d.identificacion.toUpperCase(),
      correo: d.correo.toLowerCase(),
    };
  }

  private datosTutor(t: DatosTutorDto) {
    return {
      id_facultad: t.id_facultad,
      titulo: t.titulo || null,
      departamento: t.departamento || null,
      especialidad: t.especialidad,
      telefono_contacto: t.telefono_contacto || null,
      biografia: t.biografia || null,
    };
  }

  async crear(d: UsuarioDto, coordinador: UsuarioActual) {
    this.validarRol(d);
    if (!d.contrasena)
      throw new BadRequestException('La contraseña inicial es obligatoria');
    const hash = await bcrypt.hash(d.contrasena, 10);
    const u = await this.prisma.$transaction(async (tx) => {
      const nuevo = await tx.usuario.create({
        data: {
          ...this.datosBase(d),
          contrasena_hash: hash,
          rol: d.rol,
          debe_cambiar_contrasena: true,
          fecha_registro: ahora(),
        },
      });
      if (d.rol === 'Estudiante') {
        await tx.estudiante.create({
          data: {
            id_usuario: nuevo.id_usuario,
            id_carrera: d.estudiante!.id_carrera,
            ciclo: d.estudiante!.ciclo ?? null,
          },
        });
      } else {
        await tx.tutor.create({
          data: { id_usuario: nuevo.id_usuario, ...this.datosTutor(d.tutor!) },
        });
        await tx.tutor_asignatura.createMany({
          data: d.tutor!.asignaturas.map((a) => ({
            id_tutor: nuevo.id_usuario,
            id_asignatura: a,
          })),
        });
      }
      await tx.notificacion.create({
        data: {
          id_usuario: coordinador.id_usuario,
          tipo: 'Usuario',
          titulo: 'Usuario registrado',
          mensaje: `Se registró a ${d.nombre_completo} como ${d.rol}.`,
          fecha_envio: ahora(),
        },
      });
      return tx.usuario.findUniqueOrThrow({
        where: { id_usuario: nuevo.id_usuario },
        include: INCLUDE_USUARIO,
      });
    });
    return mapUsuario(u);
  }

  async editar(idUsuario: number, d: UsuarioDto) {
    const actual = await this.prisma.usuario.findUnique({
      where: { id_usuario: idUsuario },
    });
    if (!actual) throw new NotFoundException('El usuario no existe.');
    if (actual.rol !== d.rol)
      throw new BadRequestException('No se puede cambiar el rol de un usuario');
    this.validarRol(d);
    const hash = d.contrasena ? await bcrypt.hash(d.contrasena, 10) : undefined;
    const u = await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id_usuario: idUsuario },
        data: {
          ...this.datosBase(d),
          ...(hash
            ? { contrasena_hash: hash, debe_cambiar_contrasena: true }
            : {}),
        },
      });
      if (d.rol === 'Estudiante') {
        await tx.estudiante.update({
          where: { id_usuario: idUsuario },
          data: {
            id_carrera: d.estudiante!.id_carrera,
            ciclo: d.estudiante!.ciclo ?? null,
          },
        });
      } else {
        await tx.tutor.update({
          where: { id_usuario: idUsuario },
          data: this.datosTutor(d.tutor!),
        });
        await tx.tutor_asignatura.deleteMany({
          where: { id_tutor: idUsuario },
        });
        await tx.tutor_asignatura.createMany({
          data: d.tutor!.asignaturas.map((a) => ({
            id_tutor: idUsuario,
            id_asignatura: a,
          })),
        });
      }
      return tx.usuario.findUniqueOrThrow({
        where: { id_usuario: idUsuario },
        include: INCLUDE_USUARIO,
      });
    });
    return mapUsuario(u);
  }

  async cambiarActivo(yo: UsuarioActual, idUsuario: number, activo: boolean) {
    if (idUsuario === yo.id_usuario && !activo)
      throw new BadRequestException('No puedes desactivar tu propia cuenta.');
    const momento = ahora();
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id_usuario: idUsuario },
        data: { activo },
      });
      // Al desactivar, se cierran sus sesiones abiertas
      if (!activo)
        await tx.sesion.updateMany({
          where: { id_usuario: idUsuario, fecha_cierre: null },
          data: { fecha_cierre: momento },
        });
    });
  }
}

@Controller('usuarios')
@Roles('Coordinador')
export class UsuariosController {
  constructor(private s: UsuariosService) {}

  @Get() listar(
    @Query('rol') rol?: string,
    @Query('q') q?: string,
    @Query('activo') activo?: string,
  ) {
    return this.s.listar({ rol, q, activo });
  }
  @Post() crear(@Body() d: UsuarioDto, @Usuario() u: UsuarioActual) {
    return this.s.crear(d, u);
  }
  @Put(':id') editar(@Param('id') i: string, @Body() d: UsuarioDto) {
    return this.s.editar(id(i), d);
  }
  @Patch(':id/activo')
  @HttpCode(204)
  activo(
    @Usuario() u: UsuarioActual,
    @Param('id') i: string,
    @Body() d: ActivoDto,
  ) {
    return this.s.cambiarActivo(u, id(i), d.activo);
  }
}

@Module({ controllers: [UsuariosController], providers: [UsuariosService] })
export class UsuariosModule {}
