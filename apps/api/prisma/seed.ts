/**
 * تجهيز النظام أول مرة:
 *  - الأدوار العشرة بصلاحياتها المتفق عليها
 *  - حساب مدير النظام (كلمة السر من SEED_ADMIN_PASSWORD، ولازم تتغير أول دخول)
 *  - لو SEED_DEMO=true (للتجربة بس، مش للتشغيل الحقيقي): مستخدم لكل دور + بيانات مصنع واقعية
 *
 * التشغيل أكتر من مرة آمن: اللي موجود مابيتعدلش.
 */
import { config as loadDotenv } from 'dotenv';
loadDotenv({ quiet: true });
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { DEFAULT_ROLES, newPassword, sqmPerCarton, sqmPerPallet } from '@rondi/shared';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client';
import { encrypt } from '../src/common/crypto';

const ARGON = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
const SYSTEM_ACTOR = { actorId: null, actorName: 'تجهيز النظام' };

export async function seed(prisma: PrismaClient, opts: { demo: boolean; adminPassword: string; demoPassword?: string; log?: (m: string) => void }) {
  const log = opts.log ?? ((m: string) => console.log(m));
  const audit = (entity: string, entityId: string, after: unknown) =>
    prisma.auditLog.create({ data: { ...SYSTEM_ACTOR, action: 'SEED', entity, entityId, after: after as Prisma.InputJsonValue } });

  // ── الأدوار
  const roleIds: Record<string, string> = {};
  for (const def of DEFAULT_ROLES) {
    const existing = await prisma.role.findUnique({ where: { code: def.code } });
    if (existing) {
      roleIds[def.code] = existing.id;
      continue;
    }
    // في وضع التجربة بنلغي الرمز الإضافي عشان تقدر تجرب على طول؛ في التشغيل الحقيقي بيفضل مطلوب
    const mfaRequired = opts.demo ? false : def.mfaRequired;
    const role = await prisma.role.create({
      data: { code: def.code, name: def.name, description: def.description, isSystem: true, mfaRequired, permissions: def.permissions },
    });
    roleIds[def.code] = role.id;
    await audit('role', role.id, { code: role.code, name: role.name, permissions: role.permissions, mfaRequired });
  }
  log(`✔ الأدوار: ${Object.keys(roleIds).length}`);

  // ── مدير النظام
  const pw = newPassword.safeParse(opts.adminPassword);
  if (!pw.success) throw new Error('SEED_ADMIN_PASSWORD is too weak: ' + pw.error.issues[0].message);
  if (!(await prisma.user.findUnique({ where: { username: 'admin' } }))) {
    const u = await prisma.user.create({
      data: {
        username: 'admin',
        fullName: 'مدير النظام',
        roleId: roleIds.SYSTEM_ADMIN,
        passwordHash: await argon2.hash(opts.adminPassword, ARGON),
        mustChangePassword: !opts.demo,
      },
    });
    await audit('user', u.id, { username: u.username, roleId: u.roleId });
    log('✔ حساب مدير النظام: admin');
  }

  if (!opts.demo) return;
  if (!opts.demoPassword) throw new Error('SEED_DEMO_PASSWORD is required when SEED_DEMO=true');

  // ── مستخدمين تجريبيين (واحد لكل دور)
  const demoHash = await argon2.hash(opts.demoPassword, ARGON);
  const people: Array<[string, string, string, string?]> = [
    ['factory.mgr', 'م. طارق الشافعي', 'FACTORY_MANAGER', '01001234501'],
    ['prod.mgr', 'م. هاني عبد الرحمن', 'PRODUCTION_MANAGER', '01001234502'],
    ['sup.a', 'محمود عبد الله', 'SHIFT_SUPERVISOR', '01101234503'],
    ['sup.b', 'رضا إبراهيم', 'SHIFT_SUPERVISOR', '01101234504'],
    ['sup.c', 'عماد جمال', 'SHIFT_SUPERVISOR', '01101234505'],
    ['quality', 'د. منى السيد', 'QUALITY_OFFICER', '01201234506'],
    ['store', 'سيد حسانين', 'STOREKEEPER', '01201234507'],
    ['maint', 'م. كريم فؤاد', 'MAINTENANCE_OFFICER', '01501234508'],
    ['sales', 'ياسر المصري', 'SALES', '01501234509'],
    ['accounts', 'أ. نادية فهمي', 'ACCOUNTANT', '01001234510'],
    ['ceo', 'م. عادل رشدي', 'EXECUTIVE', '01001234511'],
  ];
  for (const [username, fullName, role, phone] of people) {
    if (await prisma.user.findUnique({ where: { username } })) continue;
    const u = await prisma.user.create({
      data: { username, fullName, roleId: roleIds[role], passwordHash: demoHash, mustChangePassword: false, phoneEnc: phone ? encrypt(phone) : null },
    });
    await audit('user', u.id, { username, roleId: u.roleId });
  }
  log(`✔ مستخدمين تجريبيين: ${people.length}`);

  // ── الموديلات
  const models: Array<[string, string, 'CERAMIC' | 'PORCELAIN', 'WALL' | 'FLOOR', 'GLOSSY' | 'MATT' | 'SATIN' | 'POLISHED' | 'STRUCTURED']> = [
    ['RYL', 'رويال رخامي', 'PORCELAIN', 'FLOOR', 'POLISHED'],
    ['KRR', 'كرارة', 'PORCELAIN', 'FLOOR', 'MATT'],
    ['ONX', 'أونيكس', 'PORCELAIN', 'FLOOR', 'POLISHED'],
    ['CMT', 'سيمنتو', 'PORCELAIN', 'FLOOR', 'MATT'],
    ['OAK', 'خشبي بلوط', 'PORCELAIN', 'FLOOR', 'STRUCTURED'],
    ['TRV', 'ترافرتينو', 'CERAMIC', 'FLOOR', 'MATT'],
    ['SND', 'ساندستون', 'CERAMIC', 'FLOOR', 'MATT'],
    ['LUX', 'لوكس أبيض', 'CERAMIC', 'WALL', 'GLOSSY'],
    ['NIL', 'نيلي ديكور', 'CERAMIC', 'WALL', 'GLOSSY'],
    ['ALX', 'إسكندراني', 'CERAMIC', 'WALL', 'SATIN'],
  ];
  const modelIds: Record<string, string> = {};
  for (const [code, name, body, use, finish] of models) {
    const row = (await prisma.productModel.findUnique({ where: { code } })) ?? (await prisma.productModel.create({ data: { code, name, body, use, finish } }));
    modelIds[code] = row.id;
  }

  // ── المقاسات (بالملّيمتر)
  const sizes: Array<[string, number, number, number]> = [
    ['2540', 400, 250, 7.5],
    ['3060', 600, 300, 8.5],
    ['4040', 400, 400, 8],
    ['4545', 450, 450, 8.5],
    ['6060', 600, 600, 9.5],
    ['60120', 1200, 600, 10],
    ['20120', 1200, 200, 10],
  ];
  const sizeRows: Record<string, { id: string; lengthMm: number; widthMm: number }> = {};
  for (const [code, lengthMm, widthMm, thicknessMm] of sizes) {
    sizeRows[code] = (await prisma.size.findUnique({ where: { code } })) ?? (await prisma.size.create({ data: { code, lengthMm, widthMm, thicknessMm } }));
  }

  // ── الأصناف: موديل + مقاس + تعبئة
  const variants: Array<[string, string, number, number, number]> = [
    ['LUX', '2540', 10, 80, 14],
    ['NIL', '2540', 10, 80, 14],
    ['LUX', '3060', 8, 60, 19.5],
    ['ALX', '3060', 8, 60, 19.5],
    ['TRV', '4040', 8, 60, 22],
    ['SND', '4040', 8, 60, 22],
    ['SND', '4545', 6, 64, 21],
    ['RYL', '6060', 4, 40, 31],
    ['KRR', '6060', 4, 40, 31],
    ['ONX', '6060', 4, 40, 31],
    ['CMT', '6060', 4, 40, 31],
    ['RYL', '60120', 2, 30, 32],
    ['KRR', '60120', 2, 30, 32],
    ['OAK', '20120', 5, 48, 27],
  ];
  for (const [m, s, pieces, cartons, weight] of variants) {
    const code = `${m}-${s}`;
    if (await prisma.productVariant.findUnique({ where: { code } })) continue;
    const size = sizeRows[s];
    await prisma.productVariant.create({
      data: {
        code,
        modelId: modelIds[m],
        sizeId: size.id,
        piecesPerCarton: pieces,
        cartonsPerPallet: cartons,
        sqmPerCarton: sqmPerCarton(size.lengthMm, size.widthMm, pieces),
        sqmPerPallet: sqmPerPallet(size.lengthMm, size.widthMm, pieces, cartons),
        cartonWeightKg: weight,
      },
    });
  }
  log(`✔ ${models.length} موديل، ${sizes.length} مقاس، ${variants.length} صنف`);

  // ── درجات اللون والعيارات
  const shades: Array<[string, string]> = [
    ['أ1', 'فاتح جداً'], ['أ2', 'فاتح'], ['أ3', 'فاتح مايل للرمادي'],
    ['ب1', 'متوسط فاتح'], ['ب2', 'متوسط'], ['ب3', 'متوسط غامق'], ['ب4', 'متوسط مايل للبيج'],
    ['ج1', 'غامق'], ['ج2', 'غامق جداً'],
  ];
  for (const [code, description] of shades) {
    if (!(await prisma.shade.findUnique({ where: { code } }))) await prisma.shade.create({ data: { code, description } });
  }
  const calibers: Array<[string, string]> = [
    ['1', 'أصغر من المقاس الاسمي بشوية'],
    ['2', 'على المقاس الاسمي'],
    ['3', 'أكبر من المقاس الاسمي بشوية'],
  ];
  for (const [code, description] of calibers) {
    if (!(await prisma.caliber.findUnique({ where: { code } }))) await prisma.caliber.create({ data: { code, description } });
  }

  // ── الخامات
  type Cat = 'BODY' | 'GLAZE' | 'COLOR' | 'INK' | 'CHEMICAL' | 'PACKAGING';
  type Unit = 'TON' | 'KG' | 'LITER' | 'PIECE' | 'ROLL';
  const materials: Array<[string, string, Cat, Unit, number, number]> = [
    ['BC-ASW', 'طفلة أسوان', 'BODY', 'TON', 400, 7],
    ['BC-SIN', 'طفلة سيناء', 'BODY', 'TON', 300, 10],
    ['KAO', 'كاولين', 'BODY', 'TON', 150, 14],
    ['FLD-NA', 'فلسبار صودي', 'BODY', 'TON', 250, 10],
    ['FLD-K', 'فلسبار بوتاسي', 'BODY', 'TON', 120, 21],
    ['SND-SI', 'رمل زجاجي', 'BODY', 'TON', 200, 5],
    ['DOL', 'دولوميت', 'BODY', 'TON', 60, 7],
    ['FRT-TR', 'فريت شفاف', 'GLAZE', 'TON', 25, 21],
    ['FRT-WH', 'فريت أبيض', 'GLAZE', 'TON', 30, 21],
    ['ENG', 'إنجوب', 'GLAZE', 'TON', 20, 14],
    ['ZRC', 'سيليكات زركونيوم', 'GLAZE', 'TON', 8, 45],
    ['INK-BG', 'حبر طباعة بيج', 'INK', 'KG', 400, 30],
    ['INK-BR', 'حبر طباعة بني', 'INK', 'KG', 300, 30],
    ['INK-BL', 'حبر طباعة أزرق', 'INK', 'KG', 150, 30],
    ['INK-BK', 'حبر طباعة أسود', 'INK', 'KG', 200, 30],
    ['OX-CO', 'أكسيد كوبالت', 'COLOR', 'KG', 50, 45],
    ['OX-FE', 'أكسيد حديد أحمر', 'COLOR', 'KG', 80, 30],
    ['STPP', 'مسيّل (فوسفات صوديوم)', 'CHEMICAL', 'TON', 3, 10],
    ['SSL', 'سيليكات صوديوم', 'CHEMICAL', 'TON', 5, 7],
    ['CMC', 'مادة لاصقة للطلا', 'CHEMICAL', 'KG', 300, 14],
    ['CTN-6060', 'كرتون ٦٠×٦٠', 'PACKAGING', 'PIECE', 8000, 7],
    ['CTN-3060', 'كرتون ٣٠×٦٠', 'PACKAGING', 'PIECE', 8000, 7],
    ['CTN-2540', 'كرتون ٢٥×٤٠', 'PACKAGING', 'PIECE', 10000, 7],
    ['PLT', 'بالتة خشب', 'PACKAGING', 'PIECE', 300, 5],
    ['SHR', 'رول شرينك', 'PACKAGING', 'ROLL', 40, 7],
    ['STR', 'شريط تربيط', 'PACKAGING', 'ROLL', 60, 7],
  ];
  for (const [code, name, category, unit, minStock, leadTimeDays] of materials) {
    if (!(await prisma.material.findUnique({ where: { code } }))) {
      await prisma.material.create({ data: { code, name, category, unit, minStock, leadTimeDays } });
    }
  }
  log(`✔ ${materials.length} خامة`);

  // ── الخطوط
  const lines: Array<[string, string, 'WALL' | 'FLOOR', 'CERAMIC' | 'PORCELAIN', number]> = [
    ['L1', 'خط ١ — حوائط', 'WALL', 'CERAMIC', 9000],
    ['L2', 'خط ٢ — أرضيات', 'FLOOR', 'CERAMIC', 12000],
    ['L3', 'خط ٣ — بورسلين', 'FLOOR', 'PORCELAIN', 10000],
  ];
  const lineIds: Record<string, string> = {};
  for (const [code, name, use, body, capacitySqmPerDay] of lines) {
    const row = (await prisma.productionLine.findUnique({ where: { code } })) ?? (await prisma.productionLine.create({ data: { code, name, use, body, capacitySqmPerDay } }));
    lineIds[code] = row.id;
  }

  // ── المعدات
  type EqType = 'BALL_MILL' | 'SPRAY_DRYER' | 'PRESS' | 'DRYER' | 'GLAZING_LINE' | 'DIGITAL_PRINTER' | 'KILN' | 'SORTING_MACHINE' | 'PACKING_MACHINE';
  type Stage = 'PREPARATION' | 'PRESSING' | 'DRYING' | 'GLAZING' | 'FIRING' | 'SORTING' | 'PACKING';
  const eq: Array<[string, string, EqType, Stage, string | null, string?]> = [
    ['BM-01', 'طاحونة ١', 'BALL_MILL', 'PREPARATION', null, 'طاحونة كرات ٣٠ طن'],
    ['BM-02', 'طاحونة ٢', 'BALL_MILL', 'PREPARATION', null, 'طاحونة كرات ٣٠ طن'],
    ['BM-03', 'طاحونة ٣', 'BALL_MILL', 'PREPARATION', null, 'طاحونة كرات للطلا'],
    ['SD-01', 'مجفف الرذاذ', 'SPRAY_DRYER', 'PREPARATION', null],
  ];
  for (const n of [1, 2, 3]) {
    const L = `L${n}`;
    const ar = ['', '١', '٢', '٣'][n];
    eq.push(
      [`PR-${n}1`, `مكبس خط ${ar}`, 'PRESS', 'PRESSING', L],
      [`DR-${n}`, `مجفف رأسي خط ${ar}`, 'DRYER', 'DRYING', L],
      [`GL-${n}`, `خط تزجيج ${ar}`, 'GLAZING_LINE', 'GLAZING', L],
      [`DP-${n}`, `طابعة ديجيتال خط ${ar}`, 'DIGITAL_PRINTER', 'GLAZING', L],
      [`KL-${n}`, `فرن ${ar}`, 'KILN', 'FIRING', L, n === 3 ? 'فرن رولر ١٥٠ متر' : 'فرن رولر ١٢٠ متر'],
      [`SO-${n}`, `ماكينة فرز خط ${ar}`, 'SORTING_MACHINE', 'SORTING', L],
      [`PK-${n}`, `ماكينة تغليف خط ${ar}`, 'PACKING_MACHINE', 'PACKING', L],
    );
  }
  eq.push(['PR-22', 'مكبس خط ٢ (ب)', 'PRESS', 'PRESSING', 'L2']);
  for (const [code, name, type, stage, line, notes] of eq) {
    if (!(await prisma.equipment.findUnique({ where: { code } }))) {
      await prisma.equipment.create({ data: { code, name, type, stage, lineId: line ? lineIds[line] : null, notes: notes ?? null } });
    }
  }
  log(`✔ ${lines.length} خطوط، ${eq.length} معدة`);

  // ── الورديات
  const shifts: Array<[string, string, string, string]> = [
    ['أ', 'الوردية الأولى', '06:00', '14:00'],
    ['ب', 'الوردية التانية', '14:00', '22:00'],
    ['ج', 'الوردية التالتة', '22:00', '06:00'],
  ];
  for (const [code, name, startTime, endTime] of shifts) {
    if (!(await prisma.shift.findUnique({ where: { code } }))) await prisma.shift.create({ data: { code, name, startTime, endTime } });
  }
  log('✔ ٣ ورديات');
  await prisma.auditLog.create({ data: { ...SYSTEM_ACTOR, action: 'SEED', entity: 'masterdata', entityId: 'demo', after: { demo: true } } });
}

if (require.main === module) {
  (async () => {
    const url = process.env.DATABASE_MIGRATE_URL ?? process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required');
    const demo = process.env.SEED_DEMO === 'true';
    if (demo && process.env.NODE_ENV === 'production') throw new Error('SEED_DEMO is not allowed in production');
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!adminPassword) throw new Error('SEED_ADMIN_PASSWORD is required');
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    try {
      await seed(prisma, { demo, adminPassword, demoPassword: process.env.SEED_DEMO_PASSWORD });
    } finally {
      await prisma.$disconnect();
    }
  })().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
