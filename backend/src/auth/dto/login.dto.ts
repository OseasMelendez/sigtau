import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Ingresa tu usuario o correo institucional' })
  @MaxLength(100)
  usuario!: string;

  @IsString()
  @IsNotEmpty({ message: 'Ingresa tu contraseña' })
  @MaxLength(100)
  contrasena!: string;
}
