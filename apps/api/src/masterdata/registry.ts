import { HttpStatus } from '@nestjs/common';
import { MASTER_DATA, sizeLabel, sqmPerCarton, sqmPerPallet, type MasterDataKind } from '@rondi/shared';
import { AppError } from '../common/errors';
import type { Tx } from '../prisma/prisma.service';

type Row = Record<string, unknown> & { id: string; version: number; isActive: boolean };

export interface KindConfig {
  /** اسم الجدول في Prisma */
  delegate: string;
  /** اسمه في سجل العمليات */
  entity: string;
  search: string[];
  orderBy: Record<string, 'asc' | 'desc'>[];
  include?: Record<string, unknown>;
  /** قبل الحفظ: فحوصات إضافية وحساب الخانات المحسوبة */
  prepare?: (tx: Tx, data: Record<string, unknown>, existing: Row | null) => Promise<Record<string, unknown>>;
  /** الاسم اللي بيظهر في القوائم المنسدلة */
  label: (row: Record<string, any>) => string;
}

const invalid = (field: string, message: string) =>
  new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION', message, { fields: { [field]: message } });

async function requireActive(tx: Tx, delegate: 'productModel' | 'size' | 'productionLine', id: string, field: string, what: string) {
  const row = await (tx[delegate] as any).findUnique({ where: { id } });
  if (!row || !row.isActive) throw invalid(field, `${what} مش موجود أو متوقف`);
  return row;
}

export const REGISTRY: Record<MasterDataKind, KindConfig> = {
  models: {
    delegate: 'productModel',
    entity: 'product_model',
    search: ['code', 'name'],
    orderBy: [{ code: 'asc' }],
    label: (r) => `${r.name} (${r.code})`,
  },
  sizes: {
    delegate: 'size',
    entity: 'size',
    search: ['code'],
    orderBy: [{ widthMm: 'asc' }, { lengthMm: 'asc' }],
    include: { _count: { select: { variants: true } } },
    label: (r) => sizeLabel(r.lengthMm, r.widthMm),
    async prepare(tx, data, existing) {
      if (existing && (data.lengthMm !== existing.lengthMm || data.widthMm !== existing.widthMm)) {
        const used = await tx.productVariant.count({ where: { sizeId: existing.id } });
        if (used > 0) {
          throw new AppError(HttpStatus.CONFLICT, 'SIZE_IN_USE', 'المقاس ده مستخدم في أصناف، فأبعاده مينفعش تتغير. اعمل مقاس جديد.');
        }
      }
      return data;
    },
  },
  variants: {
    delegate: 'productVariant',
    entity: 'product_variant',
    search: ['code'],
    orderBy: [{ code: 'asc' }],
    include: { model: { select: { id: true, code: true, name: true } }, size: { select: { id: true, code: true, lengthMm: true, widthMm: true } } },
    label: (r) => (r.model && r.size ? `${r.model.name} ${sizeLabel(r.size.lengthMm, r.size.widthMm)}` : r.code),
    async prepare(tx, data, existing) {
      if (existing && (data.modelId !== existing.modelId || data.sizeId !== existing.sizeId)) {
        throw new AppError(HttpStatus.CONFLICT, 'VARIANT_IDENTITY', 'الموديل والمقاس بتوع الصنف مايتغيروش. اعمل صنف جديد.');
      }
      const model = await requireActive(tx, 'productModel', data.modelId as string, 'modelId', 'الموديل');
      const size = await requireActive(tx, 'size', data.sizeId as string, 'sizeId', 'المقاس');
      const pieces = data.piecesPerCarton as number;
      const cartons = data.cartonsPerPallet as number;
      return {
        ...data,
        code: `${model.code}-${size.code}`.slice(0, 45),
        sqmPerCarton: sqmPerCarton(size.lengthMm, size.widthMm, pieces),
        sqmPerPallet: sqmPerPallet(size.lengthMm, size.widthMm, pieces, cartons),
      };
    },
  },
  shades: { delegate: 'shade', entity: 'shade', search: ['code', 'description'], orderBy: [{ code: 'asc' }], label: (r) => r.code },
  calibers: { delegate: 'caliber', entity: 'caliber', search: ['code', 'description'], orderBy: [{ code: 'asc' }], label: (r) => r.code },
  materials: {
    delegate: 'material',
    entity: 'material',
    search: ['code', 'name'],
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    label: (r) => `${r.name} (${r.code})`,
  },
  lines: {
    delegate: 'productionLine',
    entity: 'production_line',
    search: ['code', 'name'],
    orderBy: [{ code: 'asc' }],
    label: (r) => r.name,
  },
  equipment: {
    delegate: 'equipment',
    entity: 'equipment',
    search: ['code', 'name'],
    orderBy: [{ code: 'asc' }],
    include: { line: { select: { id: true, code: true, name: true } } },
    label: (r) => `${r.name} (${r.code})`,
    async prepare(tx, data) {
      if (data.lineId) await requireActive(tx, 'productionLine', data.lineId as string, 'lineId', 'الخط');
      return { ...data, lineId: data.lineId ?? null };
    },
  },
  shifts: {
    delegate: 'shift',
    entity: 'shift',
    search: ['code', 'name'],
    orderBy: [{ startTime: 'asc' }],
    label: (r) => r.name,
    async prepare(_tx, data) {
      if (data.startTime === data.endTime) throw invalid('endTime', 'نهاية الوردية لازم تختلف عن بدايتها');
      return data;
    },
  },
};

export function schemaFor(kind: MasterDataKind) {
  return MASTER_DATA[kind].schema;
}
