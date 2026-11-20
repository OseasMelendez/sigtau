import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DbErrorFilter } from './common/db-error.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.use(helmet()); // encabezados de seguridad (RNF-02)
  app.use(cookieParser());
  app.enableCors({ origin: process.env.FRONTEND_URL, credentials: true });

  // class-validator: rechaza campos que no estén en el DTO y convierte tipos
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DbErrorFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`SIGTAU API en http://localhost:${port}/api`);
}
bootstrap();
