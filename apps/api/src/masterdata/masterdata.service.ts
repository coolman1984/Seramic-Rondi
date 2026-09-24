import { Injectable } from '@nestjs/common';
import { MASTER_DATA, MASTER_DATA_KINDS, type ListQuery, type MasterDataKind } from '@rondi/shared';
import { notFound, staleVersion } from '../common/errors';
import type { RequestMeta } from '../common/request';
import { AuditService, diff, type Actor } from '../audit/audit.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService, type Tx } from '../prisma/prisma.service';
import { REGISTRY } from './registry';

/** الأرقام العشرية بترجع أرقام عادية (مش نصوص) عشان الشاشات تتعامل معاها بسهولة. */
export function plain<T>(row: T): T {
  if (row === null || row === undefined) return row;
  if (Prisma.Decimal.isDecimal(row)) return Number(row) as unknown as T;
  if (row instanceof Date) return row;
  if (Array.isArray(row)) return row.map(plain) as unknown as T;
  if (typeof row === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) out[k] = plain(v);
    return out as T;
  }
  return row;
}

function delegate(db: Tx | PrismaService, kind: MasterDataKind): any {
  return (db as any)[REGISTRY[kind].delegate];
}

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(kind: MasterDataKind, q: ListQuery) {
    const cfg = REGISTRY[kind];
    const where: Record<string, unknown> = {
      isActive: q.includeInactive ? undefined : true,
      OR: q.q ? cfg.search.map((f) => ({ [f]: { contains: q.q, mode: 'insensitive' } })) : undefined,
    };
    const d = delegate(this.prisma, kind);
    const [total, rows] = await Promise.all([
      d.count({ where }),
      d.findMany({ where, include: cfg.include, orderBy: [{ isActive: 'desc' }, ...cfg.orderBy], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
    ]);
    return { total, page: q.page, pageSize: q.pageSize, rows: rows.map((r: any) => plain({ ...r, label: cfg.label(r) })) };
  }

  async get(kind: MasterDataKind, id: string) {
    const cfg = REGISTRY[kind];
    const row = await delegate(this.prisma, kind).findUnique({ where: { id }, include: cfg.include });
    if (!row) throw notFound(MASTER_DATA[kind].single);
    return plain({ ...row, label: cfg.label(row) });
  }

  async create(kind: MasterDataKind, input: Record<string, unknown>, actor: Actor, meta: RequestMeta) {
    const cfg = REGISTRY[kind];
    return this.prisma.$transaction(async (tx) => {
      const data = cfg.prepare ? await cfg.prepare(tx, { ...input }, null) : input;
      const row = await delegate(tx, kind).create({ data: { ...data, createdById: actor.userId, updatedById: actor.userId }, include: cfg.include });
      await this.audit.record(tx, actor, meta, { action: 'CREATE', entity: cfg.entity, entityId: row.id, after: plain(strip(row)) });
      return plain({ ...row, label: cfg.label(row) });
    });
  }

  async update(kind: MasterDataKind, id: string, input: Record<string, unknown> & { version: number }, actor: Actor, meta: RequestMeta) {
    const cfg = REGISTRY[kind];
    return this.prisma.$transaction(async (tx) => {
      const d = delegate(tx, kind);
      const before = await d.findUnique({ where: { id } });
      if (!before) throw notFound(MASTER_DATA[kind].single);
      const { version, ...rest } = input;
      const data = cfg.prepare ? await cfg.prepare(tx, rest, before) : rest;
      const res = await d.updateMany({ where: { id, version }, data: { ...data, updatedById: actor.userId, version: { increment: 1 } } });
      if (res.count === 0) throw staleVersion();
      const after = await d.findUniqueOrThrow({ where: { id }, include: cfg.include });
      const changes = diff(plain(before), plain(strip(after)));
      if (changes) await this.audit.record(tx, actor, meta, { action: 'UPDATE', entity: cfg.entity, entityId: id, ...changes });
      return plain({ ...after, label: cfg.label(after) });
    });
  }

  async setActive(kind: MasterDataKind, id: string, active: boolean, version: number, actor: Actor, meta: RequestMeta) {
    const cfg = REGISTRY[kind];
    return this.prisma.$transaction(async (tx) => {
      const d = delegate(tx, kind);
      const res = await d.updateMany({ where: { id, version }, data: { isActive: active, updatedById: actor.userId, version: { increment: 1 } } });
      if (res.count === 0) throw (await d.findUnique({ where: { id } })) ? staleVersion() : notFound(MASTER_DATA[kind].single);
      await this.audit.record(tx, actor, meta, {
        action: active ? 'ACTIVATE' : 'DEACTIVATE',
        entity: cfg.entity,
        entityId: id,
        before: { isActive: !active },
        after: { isActive: active },
      });
      const row = await d.findUniqueOrThrow({ where: { id }, include: cfg.include });
      return plain({ ...row, label: cfg.label(row) });
    });
  }

  /** قوائم خفيفة للاختيار منها في الشاشات (الشغال بس). */
  async options() {
    const out: Record<string, Array<{ id: string; code: string; label: string }>> = {};
    for (const kind of MASTER_DATA_KINDS) {
      const cfg = REGISTRY[kind];
      const rows = await delegate(this.prisma, kind).findMany({ where: { isActive: true }, include: cfg.include, orderBy: cfg.orderBy, take: 1000 });
      out[kind] = rows.map((r: any) => ({ id: r.id, code: r.code, label: cfg.label(r) }));
    }
    return out;
  }
}

/** بنشيل العلاقات والعدّادات من اللي بيتسجل في السجل. */
function strip(row: Record<string, unknown>) {
  const { _count, model, size, line, ...rest } = row as Record<string, unknown>;
  void _count; void model; void size; void line;
  return rest;
}
