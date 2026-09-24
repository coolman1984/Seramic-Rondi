import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaClient } from '../src/generated/prisma/client';
import { seed } from '../prisma/seed';

export const ADMIN_PASSWORD = 'Admin-Test-2026';
export const DEMO_PASSWORD = 'Demo-Test-2026';
export const ORIGIN = 'http://localhost:3000';

const TABLES = [
  'sessions', 'audit_log', 'product_variants', 'equipment', 'users', 'roles', 'product_models',
  'sizes', 'shades', 'calibers', 'materials', 'production_lines', 'shifts',
];

export function db() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
}

/** بيفضّي الجداول (TRUNCATE مش DELETE، فحماية المسح مابتعترضش) ويحط البيانات التجريبية. */
export async function resetDb(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
  await seed(prisma, { demo: true, adminPassword: ADMIN_PASSWORD, demoPassword: DEMO_PASSWORD, log: () => undefined });
}

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
  configureApp(app);
  await app.init();
  return app;
}

type Agent = ReturnType<typeof request.agent>;

export interface Client {
  agent: Agent;
  csrf: string;
  profile: any;
  get: (url: string) => request.Test;
  post: (url: string, body?: object) => request.Test;
  patch: (url: string, body?: object) => request.Test;
}

export function wrap(agent: Agent, profile: any): Client {
  const c: Client = {
    agent,
    csrf: profile?.csrfToken,
    profile,
    get: (url) => agent.get(url),
    post: (url, body = {}) => agent.post(url).set('x-csrf-token', c.csrf).set('origin', ORIGIN).send(body),
    patch: (url, body = {}) => agent.patch(url).set('x-csrf-token', c.csrf).set('origin', ORIGIN).send(body),
  };
  return c;
}

export function rawLogin(app: INestApplication, username: string, password: string, agent?: Agent) {
  const a = agent ?? request.agent(app.getHttpServer());
  return { agent: a, req: a.post('/api/auth/login').set('x-requested-with', 'rondi').set('origin', ORIGIN).send({ username, password }) };
}

export async function login(app: INestApplication, username: string, password = DEMO_PASSWORD): Promise<Client> {
  const { agent, req } = rawLogin(app, username, password);
  const res = await req;
  if (res.status !== 200) throw new Error(`login ${username} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return wrap(agent, res.body);
}

export async function roleId(prisma: PrismaClient, code: string) {
  return (await prisma.role.findUniqueOrThrow({ where: { code } })).id;
}
