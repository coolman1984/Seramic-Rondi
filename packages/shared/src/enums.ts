/** القوائم الثابتة وأسمائها بالعربي. المفتاح بالإنجليزي بيتخزن، والاسم العربي بيظهر. */
function labels<const T extends Record<string, string>>(map: T) {
  return { values: Object.keys(map) as Array<keyof T & string>, labels: map };
}

export const PRODUCTION_STAGE = labels({
  PREPARATION: 'تحضير الخامات',
  PRESSING: 'الكبس',
  DRYING: 'التجفيف',
  GLAZING: 'التزجيج والطباعة',
  FIRING: 'الحرق في الفرن',
  SORTING: 'الفرز',
  PACKING: 'التغليف',
  WAREHOUSE: 'المخزن',
});

export const EQUIPMENT_TYPE = labels({
  BALL_MILL: 'طاحونة',
  SPRAY_DRYER: 'مجفف رذاذ',
  PRESS: 'مكبس',
  DRYER: 'مجفف',
  GLAZING_LINE: 'خط تزجيج',
  DIGITAL_PRINTER: 'طابعة ديجيتال',
  KILN: 'فرن',
  SORTING_MACHINE: 'ماكينة فرز',
  PACKING_MACHINE: 'ماكينة تغليف',
  OTHER: 'أخرى',
});

export const MATERIAL_CATEGORY = labels({
  BODY: 'خامات البودي',
  GLAZE: 'فريت وطلا',
  COLOR: 'أكاسيد وألوان',
  INK: 'أحبار طباعة',
  CHEMICAL: 'كيماويات ومساعدات',
  PACKAGING: 'مواد تغليف',
});

export const MATERIAL_UNIT = labels({
  TON: 'طن',
  KG: 'كجم',
  LITER: 'لتر',
  PIECE: 'قطعة',
  ROLL: 'رول',
});

export const PRODUCT_BODY = labels({
  CERAMIC: 'سيراميك',
  PORCELAIN: 'بورسلين',
});

export const PRODUCT_USE = labels({
  WALL: 'حوائط',
  FLOOR: 'أرضيات',
});

export const SURFACE_FINISH = labels({
  GLOSSY: 'لامع',
  MATT: 'مط',
  SATIN: 'نص لامع',
  POLISHED: 'مصقول',
  STRUCTURED: 'بارز',
});

/** درجات الفرز الأربعة. */
export const QUALITY_GRADE = labels({
  FIRST: 'فرز أول',
  SECOND: 'فرز تاني',
  THIRD: 'فرز تالت',
  SCRAP: 'هالك',
});

export type ProductionStage = (typeof PRODUCTION_STAGE.values)[number];
export type EquipmentType = (typeof EQUIPMENT_TYPE.values)[number];
export type MaterialCategory = (typeof MATERIAL_CATEGORY.values)[number];
export type MaterialUnit = (typeof MATERIAL_UNIT.values)[number];
export type ProductBody = (typeof PRODUCT_BODY.values)[number];
export type ProductUse = (typeof PRODUCT_USE.values)[number];
export type SurfaceFinish = (typeof SURFACE_FINISH.values)[number];
export type QualityGrade = (typeof QUALITY_GRADE.values)[number];
