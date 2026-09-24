import { z } from 'zod';
import {
  EQUIPMENT_TYPE,
  MATERIAL_CATEGORY,
  MATERIAL_UNIT,
  PRODUCTION_STAGE,
  PRODUCT_BODY,
  PRODUCT_USE,
  SURFACE_FINISH,
} from '../enums';
import { code, decimal, id, int, optionalText, text, timeOfDay } from './common';

const choice = <T extends string>(values: readonly T[], label: string) =>
  z.enum(values as [T, ...T[]], { error: `اختار ${label}` });

// الموديل: الشكل/التصميم (رويال رخامي، كرارة، ...)
export const productModelSchema = z.object({
  code: code('كود الموديل'),
  name: text(2, 80, 'اسم الموديل'),
  body: choice(PRODUCT_BODY.values, 'نوع البودي'),
  use: choice(PRODUCT_USE.values, 'الاستخدام'),
  finish: choice(SURFACE_FINISH.values, 'السطح'),
  notes: optionalText(500, 'الملاحظات'),
});

// المقاس بالملّيمتر
export const sizeSchema = z.object({
  code: code('كود المقاس'),
  lengthMm: int('الطول', 50, 3200),
  widthMm: int('العرض', 50, 1600),
  thicknessMm: decimal('السُمك', 3, 30),
});

// الصنف = موديل + مقاس + طريقة التعبئة
export const productVariantSchema = z.object({
  modelId: id,
  sizeId: id,
  piecesPerCarton: int('عدد البلاطات في الكرتونة', 1, 100),
  cartonsPerPallet: int('عدد الكراتين في البالتة', 1, 400),
  cartonWeightKg: decimal('وزن الكرتونة', 0, 100).nullable().optional(),
});

export const shadeSchema = z.object({
  code: code('كود درجة اللون', 10),
  description: optionalText(200, 'الوصف'),
});

export const caliberSchema = z.object({
  code: code('كود العيار', 10),
  description: optionalText(200, 'الوصف'),
});

export const materialSchema = z.object({
  code: code('كود الخامة'),
  name: text(2, 80, 'اسم الخامة'),
  category: choice(MATERIAL_CATEGORY.values, 'نوع الخامة'),
  unit: choice(MATERIAL_UNIT.values, 'الوحدة'),
  minStock: decimal('حد الطلب', 0, 1_000_000),
  leadTimeDays: int('مدة التوريد', 0, 365),
  notes: optionalText(500, 'الملاحظات'),
});

export const productionLineSchema = z.object({
  code: code('كود الخط'),
  name: text(2, 60, 'اسم الخط'),
  use: choice(PRODUCT_USE.values, 'نوع الخط'),
  body: choice(PRODUCT_BODY.values, 'نوع البودي'),
  capacitySqmPerDay: decimal('الطاقة اليومية', 0, 1_000_000),
});

export const equipmentSchema = z.object({
  code: code('كود المعدة'),
  name: text(2, 80, 'اسم المعدة'),
  type: choice(EQUIPMENT_TYPE.values, 'نوع المعدة'),
  stage: choice(PRODUCTION_STAGE.values, 'المرحلة'),
  lineId: id.nullable().optional(),
  notes: optionalText(500, 'الملاحظات'),
});

export const shiftSchema = z.object({
  code: code('كود الوردية', 5),
  name: text(2, 40, 'اسم الوردية'),
  startTime: timeOfDay('بداية الوردية'),
  endTime: timeOfDay('نهاية الوردية'),
});

/** كل جداول البيانات الأساسية في مكان واحد، عشان الخادم والشاشات يمشوا على نفس القواعد. */
export const MASTER_DATA = {
  models: { label: 'الموديلات', single: 'موديل', schema: productModelSchema },
  sizes: { label: 'المقاسات', single: 'مقاس', schema: sizeSchema },
  variants: { label: 'الأصناف والتعبئة', single: 'صنف', schema: productVariantSchema },
  shades: { label: 'درجات اللون', single: 'درجة لون', schema: shadeSchema },
  calibers: { label: 'العيارات', single: 'عيار', schema: caliberSchema },
  materials: { label: 'الخامات', single: 'خامة', schema: materialSchema },
  lines: { label: 'خطوط الإنتاج', single: 'خط', schema: productionLineSchema },
  equipment: { label: 'المعدات والأفران', single: 'معدة', schema: equipmentSchema },
  shifts: { label: 'الورديات', single: 'وردية', schema: shiftSchema },
} as const;

export type MasterDataKind = keyof typeof MASTER_DATA;
export const MASTER_DATA_KINDS = Object.keys(MASTER_DATA) as MasterDataKind[];
export type MasterDataInput<K extends MasterDataKind> = z.infer<(typeof MASTER_DATA)[K]['schema']>;
