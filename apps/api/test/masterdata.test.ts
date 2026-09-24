import type { INestApplication } from '@nestjs/common';
import { Client as PgClient } from 'pg';
import { ADMIN_PASSWORD, createApp, db, login, type Client, resetDb } from './helpers';

const prisma = db();
let app: INestApplication;
let admin: Client;
let manager: Client;

beforeAll(async () => {
  await resetDb(prisma);
  app = await createApp();
  admin = await login(app, 'admin', ADMIN_PASSWORD);
  manager = await login(app, 'prod.mgr');
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('demo data is realistic and complete', () => {
  it('loads the factory lists', async () => {
    const opts = (await admin.get('/api/master/options')).body;
    expect(opts.models.length).toBe(10);
    expect(opts.sizes.length).toBe(7);
    expect(opts.variants.length).toBe(14);
    expect(opts.shifts.map((s: any) => s.code)).toEqual(['أ', 'ب', 'ج']);
    expect(opts.lines.length).toBe(3);
    expect(opts.equipment.length).toBeGreaterThan(20);
    expect(opts.materials.length).toBeGreaterThan(20);
  });

  it('computes packaging correctly for 60×60 porcelain', async () => {
    const res = await admin.get('/api/master/variants?q=RYL-6060');
    const v = res.body.rows[0];
    expect(v.sqmPerCarton).toBe(1.44);
    expect(v.sqmPerPallet).toBe(57.6);
    expect(v.label).toBe('رويال رخامي 60×60');
  });
});

describe.each([
  ['models', { code: 'GRN', name: 'جرانيتو', body: 'PORCELAIN', use: 'FLOOR', finish: 'MATT' }, { name: 'جرانيتو رمادي' }],
  ['sizes', { code: '3030', lengthMm: 300, widthMm: 300, thicknessMm: 7 }, { thicknessMm: 7.5 }],
  ['shades', { code: 'د1', description: 'أغمق درجة' }, { description: 'أغمق درجة خالص' }],
  ['calibers', { code: '4', description: 'عيار زيادة' }, { description: 'عيار زيادة كبير' }],
  ['materials', { code: 'TLC', name: 'تلك', category: 'BODY', unit: 'TON', minStock: 10, leadTimeDays: 14 }, { minStock: 12.5 }],
  ['lines', { code: 'L4', name: 'خط ٤ — تجريبي', use: 'WALL', body: 'CERAMIC', capacitySqmPerDay: 5000 }, { capacitySqmPerDay: 5500 }],
  ['shifts', { code: 'د', name: 'وردية إضافية', startTime: '08:00', endTime: '16:00' }, { endTime: '17:00' }],
])('%s: full lifecycle', (kind, create, change) => {
  let row: any;

  it('creates with audit', async () => {
    const res = await manager.post(`/api/master/${kind}`, create);
    expect(res.status).toBe(201);
    row = res.body;
    expect(row.version).toBe(1);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: row.id, action: 'CREATE' } });
    expect(log.actorName).toBe('م. هاني عبد الرحمن');
    expect(log.before).toBeNull();
  });

  it('rejects duplicate codes', async () => {
    const res = await manager.post(`/api/master/${kind}`, create);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE');
  });

  it('updates and records old and new values', async () => {
    const res = await manager.patch(`/api/master/${kind}/${row.id}`, { ...create, ...change, version: row.version });
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: row.id, action: 'UPDATE' } });
    const [field] = Object.keys(change);
    expect((log.before as any)[field]).toEqual((create as any)[field]);
    expect((log.after as any)[field]).toEqual((change as any)[field]);
    row = res.body;
  });

  it('refuses a stale edit', async () => {
    const res = await manager.patch(`/api/master/${kind}/${row.id}`, { ...create, version: 1 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STALE_VERSION');
  });

  it('deactivates instead of deleting, and can reactivate', async () => {
    const off = await manager.post(`/api/master/${kind}/${row.id}/deactivate`, { version: row.version });
    expect(off.status).toBe(200);
    expect(off.body.isActive).toBe(false);
    const list = await manager.get(`/api/master/${kind}?q=${encodeURIComponent(create.code)}`);
    expect(list.body.rows.find((r: any) => r.id === row.id)).toBeUndefined();
    const all = await manager.get(`/api/master/${kind}?includeInactive=true&q=${encodeURIComponent(create.code)}`);
    expect(all.body.rows.find((r: any) => r.id === row.id)).toBeDefined();
    const on = await manager.post(`/api/master/${kind}/${row.id}/activate`, { version: off.body.version });
    expect(on.body.isActive).toBe(true);
  });
});

describe('product variants', () => {
  let opts: any;
  beforeAll(async () => {
    opts = (await admin.get('/api/master/options')).body;
  });
  const id = (list: string, code: string) => opts[list].find((x: any) => x.code === code).id;

  it('builds the code and packaging from model and size', async () => {
    const res = await manager.post('/api/master/variants', { modelId: id('models', 'ONX'), sizeId: id('sizes', '60120'), piecesPerCarton: '٢', cartonsPerPallet: '٣٠', cartonWeightKg: '٣٢٫٥' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('ONX-60120');
    expect(res.body.sqmPerCarton).toBe(1.44);
    expect(res.body.sqmPerPallet).toBe(43.2);
    expect(res.body.cartonWeightKg).toBe(32.5);
  });

  it('does not allow the same model and size twice', async () => {
    const res = await manager.post('/api/master/variants', { modelId: id('models', 'ONX'), sizeId: id('sizes', '60120'), piecesPerCarton: 2, cartonsPerPallet: 30 });
    expect(res.status).toBe(409);
  });

  it('does not allow changing the model or size of an existing variant', async () => {
    const v = (await manager.get('/api/master/variants?q=ONX-60120')).body.rows[0];
    const res = await manager.patch(`/api/master/variants/${v.id}`, { modelId: id('models', 'KRR'), sizeId: v.sizeId, piecesPerCarton: 2, cartonsPerPallet: 30, version: v.version });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('VARIANT_IDENTITY');
  });

  it('recomputes m² when the packaging changes', async () => {
    const v = (await manager.get('/api/master/variants?q=ONX-60120')).body.rows[0];
    const res = await manager.patch(`/api/master/variants/${v.id}`, { modelId: v.modelId, sizeId: v.sizeId, piecesPerCarton: 3, cartonsPerPallet: 20, version: v.version });
    expect(res.status).toBe(200);
    expect(res.body.sqmPerCarton).toBe(2.16);
    expect(res.body.sqmPerPallet).toBe(43.2);
  });

  it('refuses to change dimensions of a size already used by variants', async () => {
    const s = (await manager.get('/api/master/sizes?q=6060')).body.rows[0];
    const res = await manager.patch(`/api/master/sizes/${s.id}`, { code: '6060', lengthMm: 610, widthMm: 610, thicknessMm: 9.5, version: s.version });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SIZE_IN_USE');
  });

  it('refuses a deactivated model', async () => {
    const m = (await manager.get('/api/master/models?q=CMT')).body.rows[0];
    await manager.post(`/api/master/models/${m.id}/deactivate`, { version: m.version });
    const res = await manager.post('/api/master/variants', { modelId: m.id, sizeId: id('sizes', '60120'), piecesPerCarton: 2, cartonsPerPallet: 30 });
    expect(res.status).toBe(400);
    expect(res.body.fields.modelId).toBeDefined();
  });
});

describe('input checking', () => {
  it('returns Arabic messages per field', async () => {
    const res = await manager.post('/api/master/materials', { code: 'bad code', name: '', category: 'GOLD', unit: 'TON', minStock: -1, leadTimeDays: 'كتير' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(['category', 'code', 'leadTimeDays', 'minStock', 'name']);
    expect(res.body.fields.minStock).toMatch(/حد الطلب/);
  });

  it('rejects hidden direction-control characters', async () => {
    const res = await manager.post('/api/master/models', { code: 'EVL', name: 'موديل‮خبيث', body: 'CERAMIC', use: 'WALL', finish: 'GLOSSY' });
    expect(res.status).toBe(400);
  });

  it('treats injection attempts as plain text', async () => {
    const name = "'; DROP TABLE users; --";
    const res = await manager.post('/api/master/models', { code: 'SQLI', name, body: 'CERAMIC', use: 'WALL', finish: 'GLOSSY' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe(name);
    expect(await prisma.user.count()).toBeGreaterThan(0);
    const search = await manager.get(`/api/master/models?q=${encodeURIComponent("' OR 1=1 --")}`);
    expect(search.status).toBe(200);
    expect(search.body.total).toBe(0);
  });

  it('ignores fields that are not allowed (like isActive or version on create)', async () => {
    const res = await manager.post('/api/master/shades', { code: 'ه1', isActive: false, version: 99, createdById: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(201);
    expect(res.body.isActive).toBe(true);
    expect(res.body.version).toBe(1);
  });

  it('rejects an unknown list name', async () => {
    expect((await manager.get('/api/master/users')).status).toBe(404);
  });

  it('rejects a shift that starts and ends at the same time', async () => {
    const res = await manager.post('/api/master/shifts', { code: 'هـ', name: 'غلط', startTime: '08:00', endTime: '08:00' });
    expect(res.status).toBe(400);
  });
});

describe('the database itself protects the data', () => {
  it('refuses to delete records, even from inside the application', async () => {
    const shade = await prisma.shade.findFirstOrThrow();
    await expect(prisma.shade.delete({ where: { id: shade.id } })).rejects.toThrow(/not allowed/);
    const u = await prisma.user.findFirstOrThrow();
    await expect(prisma.user.delete({ where: { id: u.id } })).rejects.toThrow(/not allowed/);
  });

  it('refuses to change or delete the audit log', async () => {
    const entry = await prisma.auditLog.findFirstOrThrow();
    await expect(prisma.auditLog.update({ where: { id: entry.id }, data: { action: 'HACKED' } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.deleteMany({})).rejects.toThrow(/not allowed/);
  });

  it('keeps an unbroken fingerprint chain', async () => {
    const res = await admin.get('/api/audit/verify');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.total).toBeGreaterThan(10);
  });

  it('detects tampering done directly in the database', async () => {
    const pg = new PgClient({ connectionString: process.env.DATABASE_URL });
    await pg.connect();
    const { rows } = await pg.query("SELECT id FROM audit_log WHERE action = 'UPDATE' ORDER BY id LIMIT 1");
    await pg.query('ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_update');
    await pg.query(`UPDATE audit_log SET actor_name = 'حد تاني' WHERE id = $1`, [rows[0].id]);
    await pg.query('ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_update');
    await pg.end();
    const res = await admin.get('/api/audit/verify');
    expect(res.body.ok).toBe(false);
    expect(res.body.brokenId).toBe(String(rows[0].id));
    expect(res.body.reason).toBe('content_changed');
  });

  it('filters the audit log by record', async () => {
    const m = (await manager.get('/api/master/models?q=GRN&includeInactive=true')).body.rows[0];
    const res = await admin.get(`/api/audit?entity=product_model&entityId=${m.id}`);
    expect(res.body.rows.map((r: any) => r.action)).toEqual(['ACTIVATE', 'DEACTIVATE', 'UPDATE', 'CREATE']);
  });
});
