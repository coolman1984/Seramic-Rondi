import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: env().DATABASE_URL }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export type { Prisma } from "../generated/prisma/client";
import type { Prisma as P } from "../generated/prisma/client";
export type Tx = P.TransactionClient;
