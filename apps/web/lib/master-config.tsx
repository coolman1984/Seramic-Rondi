import type { ReactNode } from 'react';
import {
  EQUIPMENT_TYPE,
  MATERIAL_CATEGORY,
  MATERIAL_UNIT,
  PRODUCTION_STAGE,
  PRODUCT_BODY,
  PRODUCT_USE,
  SURFACE_FINISH,
  sizeLabel,
  type MasterDataKind,
} from '@rondi/shared';
import { arDigits, num } from './format';

export type FieldDef = {
  name: string;
  label: string;
  type: 'text' | 'code' | 'number' | 'select' | 'time' | 'ref' | 'textarea';
  options?: Record<string, string>;
  ref?: 'models' | 'sizes' | 'lines';
  optional?: boolean;
  hint?: string;
  placeholder?: string;
  /** مايتغيرش بعد الإنشاء */
  lockOnEdit?: boolean;
};

export type Row = Record<string, any> & { id: string; version: number; isActive: boolean; label: string; code: string };

export type ColumnDef = { key: string; label: string; render: (r: Row) => ReactNode; numeric?: boolean; primary?: boolean };

export interface KindUi {
  group: 'product' | 'production' | 'stores';
  description: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  empty: Record<string, unknown>;
}

const t = (map: Record<string, string>) => (v: string) => map[v] ?? v;

export const MASTER_UI: Record<MasterDataKind, KindUi> = {
  models: {
    group: 'product',
    description: 'التصميمات اللي المصنع بينتجها: رويال، كرارة، خشبي…',
    fields: [
      { name: 'code', label: 'الكود', type: 'code', placeholder: 'RYL', hint: 'حروف وأرقام من غير مسافات' },
      { name: 'name', label: 'اسم الموديل', type: 'text', placeholder: 'رويال رخامي' },
      { name: 'body', label: 'نوع البودي', type: 'select', options: PRODUCT_BODY.labels },
      { name: 'use', label: 'الاستخدام', type: 'select', options: PRODUCT_USE.labels },
      { name: 'finish', label: 'السطح', type: 'select', options: SURFACE_FINISH.labels },
      { name: 'notes', label: 'ملاحظات', type: 'textarea', optional: true },
    ],
    columns: [
      { key: 'name', label: 'الموديل', render: (r) => r.name, primary: true },
      { key: 'code', label: 'الكود', render: (r) => <code dir="ltr">{r.code}</code> },
      { key: 'body', label: 'البودي', render: (r) => t(PRODUCT_BODY.labels)(r.body) },
      { key: 'use', label: 'الاستخدام', render: (r) => t(PRODUCT_USE.labels)(r.use) },
      { key: 'finish', label: 'السطح', render: (r) => t(SURFACE_FINISH.labels)(r.finish) },
    ],
    empty: { code: '', name: '', body: 'CERAMIC', use: 'FLOOR', finish: 'MATT', notes: '' },
  },
  sizes: {
    group: 'product',
    description: 'المقاسات بالملّيمتر. أبعاد المقاس المستخدم في أصناف مابتتغيرش.',
    fields: [
      { name: 'code', label: 'الكود', type: 'code', placeholder: '6060' },
      { name: 'widthMm', label: 'العرض (مم)', type: 'number', placeholder: '600' },
      { name: 'lengthMm', label: 'الطول (مم)', type: 'number', placeholder: '600' },
      { name: 'thicknessMm', label: 'السُمك (مم)', type: 'number', placeholder: '9.5' },
    ],
    columns: [
      { key: 'label', label: 'المقاس (سم)', render: (r) => <span className="tabular">{arDigits(sizeLabel(r.lengthMm, r.widthMm))}</span>, primary: true },
      { key: 'code', label: 'الكود', render: (r) => <code dir="ltr">{r.code}</code> },
      { key: 'thicknessMm', label: 'السُمك', render: (r) => `${num(r.thicknessMm)} مم`, numeric: true },
      { key: 'variants', label: 'أصناف عليه', render: (r) => num(r._count?.variants ?? 0), numeric: true },
    ],
    empty: { code: '', widthMm: '', lengthMm: '', thicknessMm: '' },
  },
  variants: {
    group: 'product',
    description: 'الصنف = موديل + مقاس + طريقة التعبئة. ده اللي بيتنتج ويتخزن ويتباع.',
    fields: [
      { name: 'modelId', label: 'الموديل', type: 'ref', ref: 'models', lockOnEdit: true },
      { name: 'sizeId', label: 'المقاس', type: 'ref', ref: 'sizes', lockOnEdit: true },
      { name: 'piecesPerCarton', label: 'بلاطات في الكرتونة', type: 'number' },
      { name: 'cartonsPerPallet', label: 'كراتين في البالتة', type: 'number' },
      { name: 'cartonWeightKg', label: 'وزن الكرتونة (كجم)', type: 'number', optional: true },
    ],
    columns: [
      { key: 'label', label: 'الصنف', render: (r) => arDigits(r.label), primary: true },
      { key: 'code', label: 'الكود', render: (r) => <code dir="ltr">{r.code}</code> },
      { key: 'piecesPerCarton', label: 'بلاطة/كرتونة', render: (r) => num(r.piecesPerCarton), numeric: true },
      { key: 'sqmPerCarton', label: 'م²/كرتونة', render: (r) => num(r.sqmPerCarton, 4), numeric: true },
      { key: 'cartonsPerPallet', label: 'كرتونة/بالتة', render: (r) => num(r.cartonsPerPallet), numeric: true },
      { key: 'sqmPerPallet', label: 'م²/بالتة', render: (r) => num(r.sqmPerPallet, 2), numeric: true },
    ],
    empty: { modelId: '', sizeId: '', piecesPerCarton: '', cartonsPerPallet: '', cartonWeightKg: '' },
  },
  shades: {
    group: 'product',
    description: 'درجات اللون اللي بتتكتب على البالتة. الطلبية الواحدة مينفعش يكون فيها غير درجة واحدة.',
    fields: [
      { name: 'code', label: 'الكود', type: 'code', placeholder: 'ب3' },
      { name: 'description', label: 'الوصف', type: 'text', optional: true, placeholder: 'متوسط غامق' },
    ],
    columns: [
      { key: 'code', label: 'الدرجة', render: (r) => <b className="font-medium">{arDigits(r.code)}</b>, primary: true },
      { key: 'description', label: 'الوصف', render: (r) => r.description ?? '—' },
    ],
    empty: { code: '', description: '' },
  },
  calibers: {
    group: 'product',
    description: 'العيار = فرق المقاس الفعلي بعد الحرق. بيتطابق مع درجة اللون في الطلبية.',
    fields: [
      { name: 'code', label: 'الكود', type: 'code', placeholder: '2' },
      { name: 'description', label: 'الوصف', type: 'text', optional: true },
    ],
    columns: [
      { key: 'code', label: 'العيار', render: (r) => <b className="font-medium">{arDigits(r.code)}</b>, primary: true },
      { key: 'description', label: 'الوصف', render: (r) => r.description ?? '—' },
    ],
    empty: { code: '', description: '' },
  },
  materials: {
    group: 'stores',
    description: 'الخامات ومواد التغليف. حد الطلب = لما الرصيد يوصله النظام ينبّه (المرحلة ٣).',
    fields: [
      { name: 'code', label: 'الكود', type: 'code', placeholder: 'FRT-WH' },
      { name: 'name', label: 'اسم الخامة', type: 'text', placeholder: 'فريت أبيض' },
      { name: 'category', label: 'النوع', type: 'select', options: MATERIAL_CATEGORY.labels },
      { name: 'unit', label: 'الوحدة', type: 'select', options: MATERIAL_UNIT.labels },
      { name: 'minStock', label: 'حد الطلب', type: 'number', hint: 'بنفس الوحدة' },
      { name: 'leadTimeDays', label: 'مدة التوريد (يوم)', type: 'number' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea', optional: true },
    ],
    columns: [
      { key: 'name', label: 'الخامة', render: (r) => r.name, primary: true },
      { key: 'code', label: 'الكود', render: (r) => <code dir="ltr">{r.code}</code> },
      { key: 'category', label: 'النوع', render: (r) => t(MATERIAL_CATEGORY.labels)(r.category) },
      { key: 'minStock', label: 'حد الطلب', render: (r) => `${num(r.minStock)} ${t(MATERIAL_UNIT.labels)(r.unit)}`, numeric: true },
      { key: 'leadTimeDays', label: 'التوريد', render: (r) => `${num(r.leadTimeDays)} يوم`, numeric: true },
    ],
    empty: { code: '', name: '', category: 'BODY', unit: 'TON', minStock: '', leadTimeDays: '', notes: '' },
  },
  lines: {
    group: 'production',
    description: 'خطوط الإنتاج وطاقتها اليومية بالمتر المربع.',
    fields: [
      { name: 'code', label: 'الكود', type: 'code', placeholder: 'L1' },
      { name: 'name', label: 'اسم الخط', type: 'text', placeholder: 'خط ١ — حوائط' },
      { name: 'use', label: 'بينتج', type: 'select', options: PRODUCT_USE.labels },
      { name: 'body', label: 'البودي', type: 'select', options: PRODUCT_BODY.labels },
      { name: 'capacitySqmPerDay', label: 'الطاقة (م²/يوم)', type: 'number' },
    ],
    columns: [
      { key: 'name', label: 'الخط', render: (r) => r.name, primary: true },
      { key: 'code', label: 'الكود', render: (r) => <code dir="ltr">{r.code}</code> },
      { key: 'use', label: 'بينتج', render: (r) => `${t(PRODUCT_USE.labels)(r.use)} · ${t(PRODUCT_BODY.labels)(r.body)}` },
      { key: 'capacity', label: 'الطاقة اليومية', render: (r) => `${num(r.capacitySqmPerDay, 0)} م²`, numeric: true },
    ],
    empty: { code: '', name: '', use: 'FLOOR', body: 'CERAMIC', capacitySqmPerDay: '' },
  },
  equipment: {
    group: 'production',
    description: 'المكابس والمجففات والأفران وكل معدة ليها صيانة أو استهلاك طاقة.',
    fields: [
      { name: 'code', label: 'الكود', type: 'code', placeholder: 'KL-2' },
      { name: 'name', label: 'اسم المعدة', type: 'text', placeholder: 'فرن ٢' },
      { name: 'type', label: 'النوع', type: 'select', options: EQUIPMENT_TYPE.labels },
      { name: 'stage', label: 'المرحلة', type: 'select', options: PRODUCTION_STAGE.labels },
      { name: 'lineId', label: 'الخط', type: 'ref', ref: 'lines', optional: true, hint: 'سيبه فاضي لو المعدة مشتركة (زي الطواحين)' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea', optional: true },
    ],
    columns: [
      { key: 'name', label: 'المعدة', render: (r) => r.name, primary: true },
      { key: 'code', label: 'الكود', render: (r) => <code dir="ltr">{r.code}</code> },
      { key: 'type', label: 'النوع', render: (r) => t(EQUIPMENT_TYPE.labels)(r.type) },
      { key: 'stage', label: 'المرحلة', render: (r) => t(PRODUCTION_STAGE.labels)(r.stage) },
      { key: 'line', label: 'الخط', render: (r) => r.line?.name ?? 'مشتركة' },
    ],
    empty: { code: '', name: '', type: 'KILN', stage: 'FIRING', lineId: null, notes: '' },
  },
  shifts: {
    group: 'production',
    description: 'الورديات ومواعيدها. الوردية ممكن تعدّي نص الليل (١٠ م لـ ٦ ص).',
    fields: [
      { name: 'code', label: 'الكود', type: 'code', placeholder: 'أ' },
      { name: 'name', label: 'الاسم', type: 'text', placeholder: 'الوردية الأولى' },
      { name: 'startTime', label: 'البداية', type: 'time' },
      { name: 'endTime', label: 'النهاية', type: 'time' },
    ],
    columns: [
      { key: 'name', label: 'الوردية', render: (r) => r.name, primary: true },
      { key: 'code', label: 'الكود', render: (r) => arDigits(r.code) },
      { key: 'time', label: 'المواعيد', render: (r) => <span className="tabular">{arDigits(r.startTime)} ← {arDigits(r.endTime)}</span> },
    ],
    empty: { code: '', name: '', startTime: '06:00', endTime: '14:00' },
  },
};

export const GROUPS: Array<{ key: KindUi['group']; label: string }> = [
  { key: 'product', label: 'المنتج' },
  { key: 'production', label: 'الإنتاج' },
  { key: 'stores', label: 'المخازن' },
];
