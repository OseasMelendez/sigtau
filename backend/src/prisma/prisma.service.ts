import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Cliente Prisma compartido por todos los módulos (capa de acceso a datos).
 * Usa el adaptador de "pg" (Prisma sin motor Rust). Todas las consultas son
 * parametrizadas, lo que evita la inyección SQL (RNF-02).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const url = new URL(process.env.DATABASE_URL!);
    const schema = url.searchParams.get('schema') ?? 'sigtau';
    url.searchParams.delete('schema');
    super({
      adapter: new PrismaPg({ connectionString: url.toString() }, { schema }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
