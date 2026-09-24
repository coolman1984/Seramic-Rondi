/**
 * كل صلاحية في النظام ليها اسم ثابت. الشاشات والخادم بيستخدموا نفس القائمة دي،
 * والخادم هو اللي بيحكم في الآخر (الشاشة بتخفي الزرار بس للراحة).
 */
export const MODULES = [
  { key: 'production', label: 'متابعة الإنتاج', phase: 2 },
  { key: 'quality', label: 'الجودة والفرز', phase: 2 },
  { key: 'fgstock', label: 'مخزن المنتج التام', phase: 3 },
  { key: 'rmstock', label: 'مخزن الخامات', phase: 3 },
  { key: 'maintenance', label: 'الصيانة', phase: 4 },
  { key: 'energy', label: 'الطاقة', phase: 4 },
  { key: 'sales', label: 'المبيعات والتحصيل', phase: 5 },
  { key: 'shipping', label: 'الشحن والتوزيع', phase: 5 },
  { key: 'planning', label: 'تخطيط الإنتاج', phase: 6 },
  { key: 'costing', label: 'تكلفة المنتج', phase: 6 },
] as const;

export type ModuleKey = (typeof MODULES)[number]['key'];

export const PERMISSIONS = {
  'users.read': 'عرض المستخدمين',
  'users.manage': 'إضافة وتعديل المستخدمين',
  'roles.manage': 'تعديل الأدوار والصلاحيات',
  'audit.read': 'عرض سجل العمليات',
  'masterdata.read': 'عرض البيانات الأساسية',
  'masterdata.manage': 'تعديل البيانات الأساسية',
  'production.read': 'عرض الإنتاج',
  'production.write': 'تسجيل الإنتاج',
  'quality.read': 'عرض الجودة والفرز',
  'quality.write': 'تسجيل الجودة والفرز',
  'fgstock.read': 'عرض مخزن المنتج التام',
  'fgstock.write': 'حركات مخزن المنتج التام',
  'rmstock.read': 'عرض مخزن الخامات',
  'rmstock.write': 'حركات مخزن الخامات',
  'maintenance.read': 'عرض الصيانة',
  'maintenance.report': 'التبليغ عن عطل',
  'maintenance.write': 'إدارة الصيانة',
  'energy.read': 'عرض الطاقة',
  'energy.write': 'تسجيل قراءات الطاقة',
  'sales.read': 'عرض المبيعات',
  'sales.write': 'تسجيل المبيعات والتحصيل',
  'shipping.read': 'عرض الشحن',
  'shipping.write': 'تسجيل الشحن',
  'planning.read': 'عرض الخطط',
  'planning.write': 'إعداد الخطط',
  'costing.read': 'عرض التكلفة',
  'costing.write': 'إعداد التكلفة',
  'dashboard.read': 'لوحة الإدارة',
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

type Level = 'f' | 'v' | 'n';

/** نفس جدول الصلاحيات اللي في الخطة: f = تسجيل وتعديل، v = عرض، n = مش ظاهر. */
const MATRIX: Record<ModuleKey, Record<string, Level>> = {
  //            FM   PM   SS   QA   WH   MT   SL   AC   EX
  production:  { FACTORY_MANAGER: 'f', PRODUCTION_MANAGER: 'f', SHIFT_SUPERVISOR: 'f', QUALITY_OFFICER: 'v', STOREKEEPER: 'n', MAINTENANCE_OFFICER: 'v', SALES: 'n', ACCOUNTANT: 'n', EXECUTIVE: 'v' },
  quality:     { FACTORY_MANAGER: 'f', PRODUCTION_MANAGER: 'v', SHIFT_SUPERVISOR: 'v', QUALITY_OFFICER: 'f', STOREKEEPER: 'n', MAINTENANCE_OFFICER: 'n', SALES: 'n', ACCOUNTANT: 'n', EXECUTIVE: 'v' },
  fgstock:     { FACTORY_MANAGER: 'v', PRODUCTION_MANAGER: 'v', SHIFT_SUPERVISOR: 'n', QUALITY_OFFICER: 'v', STOREKEEPER: 'f', MAINTENANCE_OFFICER: 'n', SALES: 'v', ACCOUNTANT: 'v', EXECUTIVE: 'v' },
  rmstock:     { FACTORY_MANAGER: 'v', PRODUCTION_MANAGER: 'v', SHIFT_SUPERVISOR: 'v', QUALITY_OFFICER: 'n', STOREKEEPER: 'f', MAINTENANCE_OFFICER: 'n', SALES: 'n', ACCOUNTANT: 'v', EXECUTIVE: 'v' },
  maintenance: { FACTORY_MANAGER: 'f', PRODUCTION_MANAGER: 'v', SHIFT_SUPERVISOR: 'v', QUALITY_OFFICER: 'n', STOREKEEPER: 'n', MAINTENANCE_OFFICER: 'f', SALES: 'n', ACCOUNTANT: 'v', EXECUTIVE: 'v' },
  energy:      { FACTORY_MANAGER: 'f', PRODUCTION_MANAGER: 'v', SHIFT_SUPERVISOR: 'v', QUALITY_OFFICER: 'n', STOREKEEPER: 'n', MAINTENANCE_OFFICER: 'f', SALES: 'n', ACCOUNTANT: 'v', EXECUTIVE: 'v' },
  sales:       { FACTORY_MANAGER: 'v', PRODUCTION_MANAGER: 'n', SHIFT_SUPERVISOR: 'n', QUALITY_OFFICER: 'n', STOREKEEPER: 'n', MAINTENANCE_OFFICER: 'n', SALES: 'f', ACCOUNTANT: 'f', EXECUTIVE: 'v' },
  shipping:    { FACTORY_MANAGER: 'v', PRODUCTION_MANAGER: 'n', SHIFT_SUPERVISOR: 'n', QUALITY_OFFICER: 'n', STOREKEEPER: 'f', MAINTENANCE_OFFICER: 'n', SALES: 'f', ACCOUNTANT: 'v', EXECUTIVE: 'v' },
  planning:    { FACTORY_MANAGER: 'f', PRODUCTION_MANAGER: 'f', SHIFT_SUPERVISOR: 'v', QUALITY_OFFICER: 'n', STOREKEEPER: 'v', MAINTENANCE_OFFICER: 'v', SALES: 'v', ACCOUNTANT: 'n', EXECUTIVE: 'v' },
  costing:     { FACTORY_MANAGER: 'v', PRODUCTION_MANAGER: 'n', SHIFT_SUPERVISOR: 'n', QUALITY_OFFICER: 'n', STOREKEEPER: 'n', MAINTENANCE_OFFICER: 'n', SALES: 'n', ACCOUNTANT: 'f', EXECUTIVE: 'v' },
};

export interface RoleDefinition {
  code: string;
  name: string;
  description: string;
  mfaRequired: boolean;
  permissions: Permission[];
}

const ROLE_META: Array<Omit<RoleDefinition, 'permissions'> & { extra: Permission[] }> = [
  { code: 'SYSTEM_ADMIN', name: 'مدير النظام', description: 'المستخدمين والصلاحيات والبيانات الأساسية وسجل العمليات', mfaRequired: true,
    extra: ['users.read', 'users.manage', 'roles.manage', 'audit.read', 'masterdata.read', 'masterdata.manage'] },
  { code: 'FACTORY_MANAGER', name: 'مدير المصنع', description: 'متابعة كل أقسام المصنع', mfaRequired: true,
    extra: ['users.read', 'audit.read', 'masterdata.read', 'masterdata.manage', 'dashboard.read'] },
  { code: 'PRODUCTION_MANAGER', name: 'مدير الإنتاج', description: 'الإنتاج والتخطيط والخطوط', mfaRequired: false,
    extra: ['masterdata.read', 'masterdata.manage', 'dashboard.read'] },
  { code: 'SHIFT_SUPERVISOR', name: 'مشرف الوردية', description: 'تسجيل إنتاج ورديته والتبليغ عن الأعطال', mfaRequired: false,
    extra: ['masterdata.read', 'maintenance.report'] },
  { code: 'QUALITY_OFFICER', name: 'مسؤول الجودة', description: 'الفرز والعيوب ودرجات اللون', mfaRequired: false,
    extra: ['masterdata.read'] },
  { code: 'STOREKEEPER', name: 'أمين المخزن', description: 'مخزن الخامات والمنتج التام والتحميل', mfaRequired: false,
    extra: ['masterdata.read'] },
  { code: 'MAINTENANCE_OFFICER', name: 'مسؤول الصيانة', description: 'الصيانة الدورية والأعطال والطاقة', mfaRequired: false,
    extra: ['masterdata.read', 'maintenance.report'] },
  { code: 'SALES', name: 'المبيعات', description: 'التجار والطلبيات والحجز', mfaRequired: false,
    extra: ['masterdata.read'] },
  { code: 'ACCOUNTANT', name: 'الحسابات', description: 'المديونيات والتحصيل والتكلفة', mfaRequired: true,
    extra: ['masterdata.read', 'audit.read', 'dashboard.read'] },
  { code: 'EXECUTIVE', name: 'الإدارة العليا', description: 'لوحة المؤشرات والتقارير', mfaRequired: true,
    extra: ['masterdata.read', 'audit.read', 'dashboard.read'] },
];

export const DEFAULT_ROLES: RoleDefinition[] = ROLE_META.map(({ extra, ...meta }) => {
  const perms = new Set<Permission>(extra);
  for (const mod of MODULES) {
    const level = MATRIX[mod.key][meta.code];
    if (level === 'v' || level === 'f') perms.add(`${mod.key}.read` as Permission);
    if (level === 'f') perms.add(`${mod.key}.write` as Permission);
  }
  if (perms.has('maintenance.write')) perms.add('maintenance.report');
  return { ...meta, permissions: ALL_PERMISSIONS.filter((p) => perms.has(p)) };
});
