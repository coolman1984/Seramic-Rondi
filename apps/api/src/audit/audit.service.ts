import { Injectable } from '@nestjs/common';
import type { AuditQuery } from '@rondi/shared';
import { Prisma } from '../generated/prisma/client';
import { PrismaService, type Tx } from '../prisma/prisma.service';
import type { RequestMeta } from '../common/request';

export interface Actor {
  userId: string | null;
  name: string | null;
}

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

// خانات مبتتسجلش في السجل أبداً (أسرار أو بيانات متشفرة)
const SECRET_FIELDS = new Set(['passwordHash', 'mfaSecretEnc', 'phoneEnc', 'tokenHash', 'csrfToken', 'mfaLastStep']);
// خانات بتتغير لوحدها ومش محتاجين نسجلها
const NOISE_FIELDS = new Set(['updatedAt', 'createdAt', 'createdById', 'updatedById']);

/** بيحوّل السجل لشكل ينفع يتخزن في السجل (JSON) ومن غير أسرار. */
export function snapshot(row: unknown): Prisma.InputJsonValue | null {
  if (row === null || row === undefined) return null;
  return JSON.parse(
    JSON.stringify(row, (key, value) => {
      if (SECRET_FIELDS.has(key)) return value == null ? null : '[محجوب]';
      if (NOISE_FIELDS.has(key)) return undefined;
      if (typeof value === 'bigint') return value.toString();
      return value;
    }),
  );
}

/** بيرجّع الخانات اللي اتغيرت بس، بالقديم والجديد. */
export function diff(before: unknown, after: unknown): { before: Prisma.InputJsonValue; after: Prisma.InputJsonValue } | null {
  const b = (snapshot(before) ?? {}) as Record<string, unknown>;
  const a = (snapshot(after) ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const ob: Record<string, unknown> = {};
  const oa: Record<string, unknown> = {};
  for (const k of keys) {
    if (k === 'version') continue;
    if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) {
      ob[k] = b[k] ?? null;
      oa[k] = a[k] ?? null;
    }
  }
  if (Object.keys(oa).length === 0) return null;
  return { before: ob as Prisma.InputJsonValue, after: oa as Prisma.InputJsonValue };
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** لازم يتنده جوه نفس العملية (transaction) اللي فيها التعديل، عشان الاتنين يتسجلوا مع بعض أو ولا واحد. */
  async record(tx: Tx | PrismaService, actor: Actor, meta: RequestMeta | null, entry: AuditEntry) {
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        actorName: actor.name,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: entry.before === undefined || entry.before === null ? Prisma.JsonNull : (snapshot(entry.before) as Prisma.InputJsonValue),
        after: entry.after === undefined || entry.after === null ? Prisma.JsonNull : (snapshot(entry.after) as Prisma.InputJsonValue),
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
      },
    });
  }

  async list(q: AuditQuery) {
    const where: Prisma.AuditLogWhereInput = {
      entity: q.entity || undefined,
      entityId: q.entityId || undefined,
      actorId: q.actorId || undefined,
      action: q.action || undefined,
      at: q.from || q.to ? { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } : undefined,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: { id: true, at: true, actorId: true, actorName: true, action: true, entity: true, entityId: true, before: true, after: true, ip: true },
      }),
    ]);
    return { total, page: q.page, pageSize: q.pageSize, rows: rows.map((r) => ({ ...r, id: r.id.toString() })) };
  }

  /** بيراجع سلسلة البصمات كلها ويقول لو في أي سطر اتلعب فيه. */
  async verifyChain() {
    const rows = await this.prisma.$queryRaw<Array<{ broken_id: bigint; reason: string }>>`SELECT * FROM rondi_audit_verify()`;
    const total = await this.prisma.auditLog.count();
    if (rows.length === 0) return { ok: true, total };
    return { ok: false, total, brokenId: rows[0].broken_id.toString(), reason: rows[0].reason };
  }
}
