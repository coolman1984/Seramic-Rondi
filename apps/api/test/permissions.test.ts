import type { INestApplication } from '@nestjs/common';
import { DEFAULT_ROLES } from '@rondi/shared';
import { ADMIN_PASSWORD, createApp, db, login, type Client, resetDb, roleId } from './helpers';

const prisma = db();
let app: INestApplication;
const clients: Record<string, Client> = {};

// مستخدم تجريبي لكل دور
const USER_OF: Record<string, [string, string?]> = {
  SYSTEM_ADMIN: ['admin', ADMIN_PASSWORD],
  FACTORY_MANAGER: ['factory.mgr'],
  PRODUCTION_MANAGER: ['prod.mgr'],
  SHIFT_SUPERVISOR: ['sup.a'],
  QUALITY_OFFICER: ['quality'],
  STOREKEEPER: ['store'],
  MAINTENANCE_OFFICER: ['maint'],
  SALES: ['sales'],
  ACCOUNTANT: ['accounts'],
  EXECUTIVE: ['ceo'],
};

beforeAll(async () => {
  await resetDb(prisma);
  app = await createApp();
  for (const [role, [username, pw]] of Object.entries(USER_OF)) clients[role] = await login(app, username, pw);
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const roles = Object.keys(USER_OF);
const has = (role: string, perm: string) => DEFAULT_ROLES.find((r) => r.code === role)!.permissions.includes(perm as never);

describe('every role gets exactly what the approved matrix says', () => {
  it.each(roles)('%s: login returns the role permissions', (role) => {
    const expected = DEFAULT_ROLES.find((r) => r.code === role)!.permissions;
    expect([...clients[role].profile.permissions].sort()).toEqual([...expected].sort());
  });

  it.each(roles)('%s: list users only with users.read', async (role) => {
    const res = await clients[role].get('/api/users');
    expect(res.status).toBe(has(role, 'users.read') ? 200 : 403);
  });

  it.each(roles)('%s: create users only with users.manage', async (role) => {
    const res = await clients[role].post('/api/users', {
      username: `probe.${role.toLowerCase().slice(0, 10)}`,
      fullName: 'تجربة صلاحيات',
      roleId: await roleId(prisma, 'SALES'),
      password: 'Probe-Pass-2026',
    });
    expect(res.status).toBe(has(role, 'users.manage') ? 201 : 403);
  });

  it.each(roles)('%s: read the audit log only with audit.read', async (role) => {
    const res = await clients[role].get('/api/audit');
    expect(res.status).toBe(has(role, 'audit.read') ? 200 : 403);
  });

  it.each(roles)('%s: everybody can read master data', async (role) => {
    expect((await clients[role].get('/api/master/models')).status).toBe(200);
    expect((await clients[role].get('/api/master/options')).status).toBe(200);
  });

  it.each(roles)('%s: change master data only with masterdata.manage', async (role) => {
    const res = await clients[role].post('/api/master/shades', { code: `T${roles.indexOf(role)}`, description: 'تجربة' });
    expect(res.status).toBe(has(role, 'masterdata.manage') ? 201 : 403);
  });

  it.each(roles)('%s: edit roles only with roles.manage', async (role) => {
    const target = await prisma.role.findUniqueOrThrow({ where: { code: 'SALES' } });
    const res = await clients[role].patch(`/api/roles/${target.id}`, { description: `تعديل ${role}`, version: target.version });
    expect(res.status).toBe(has(role, 'roles.manage') ? 200 : 403);
  });
});

describe('phone numbers', () => {
  it('are encrypted in the database', async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { username: 'sup.a' } });
    expect(u.phoneEnc).toMatch(/^v1\./);
    expect(u.phoneEnc).not.toContain('01101234503');
  });

  it('are shown in full to user managers and masked to viewers', async () => {
    const full = await clients.SYSTEM_ADMIN.get('/api/users?q=sup.a');
    const masked = await clients.FACTORY_MANAGER.get('/api/users?q=sup.a');
    expect(full.body.rows[0].phone).toBe('01101234503');
    expect(masked.body.rows[0].phone).toBe('011•••••503');
  });
});

describe('role changes take effect immediately', () => {
  it('adding a permission opens the door on the next request', async () => {
    const store = clients.STOREKEEPER;
    expect((await store.get('/api/audit')).status).toBe(403);
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'STOREKEEPER' } });
    const res = await clients.SYSTEM_ADMIN.patch(`/api/roles/${role.id}`, { permissions: [...role.permissions, 'audit.read'], version: role.version });
    expect(res.status).toBe(200);
    expect((await store.get('/api/audit')).status).toBe(200);
  });

  it('rejects unknown permissions', async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'SALES' } });
    const res = await clients.SYSTEM_ADMIN.patch(`/api/roles/${role.id}`, { permissions: ['sales.read', 'root.everything'], version: role.version });
    expect(res.status).toBe(400);
  });

  it('records the old and new permissions in the audit log', async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'STOREKEEPER' } });
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entity: 'role', entityId: role.id, action: 'UPDATE' }, orderBy: { id: 'desc' } });
    expect((entry.before as any).permissions).not.toContain('audit.read');
    expect((entry.after as any).permissions).toContain('audit.read');
    expect(entry.actorName).toBe('مدير النظام');
  });

  it('moving a user to another role logs them out so they get the new screens', async () => {
    const victim = await login(app, 'sales');
    const u = await prisma.user.findUniqueOrThrow({ where: { username: 'sales' } });
    const res = await clients.SYSTEM_ADMIN.patch(`/api/users/${u.id}`, { roleId: await roleId(prisma, 'EXECUTIVE'), version: u.version });
    expect(res.status).toBe(200);
    expect(res.body.role.code).toBe('EXECUTIVE');
    expect((await victim.get('/api/auth/me')).status).toBe(401);
  });
});

describe('the system can never lock itself out', () => {
  it('the system-admin role keeps its core permissions', async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: 'SYSTEM_ADMIN' } });
    const res = await clients.SYSTEM_ADMIN.patch(`/api/roles/${role.id}`, { permissions: ['masterdata.read'], version: role.version });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ADMIN_ROLE_LOCKED');
  });

  it('an admin cannot deactivate their own account', async () => {
    const me = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });
    const res = await clients.SYSTEM_ADMIN.post(`/api/users/${me.id}/deactivate`, { version: me.version });
    expect(res.status).toBe(400);
  });

  it('the last admin cannot be moved to a weaker role', async () => {
    // مدير تاني بيحاول ينقل الأدمن الوحيد لدور تاني
    const admin2 = await clients.SYSTEM_ADMIN.post('/api/users', { username: 'admin2', fullName: 'مدير احتياطي', roleId: await roleId(prisma, 'SYSTEM_ADMIN'), password: 'Backup-Admin-2026' });
    expect(admin2.status).toBe(201);
    const a2 = await prisma.user.findUniqueOrThrow({ where: { username: 'admin2' } });
    // نوقف الاحتياطي، فيفضل admin لوحده
    expect((await clients.SYSTEM_ADMIN.post(`/api/users/${a2.id}/deactivate`, { version: a2.version })).status).toBe(200);
    const me = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });
    const res = await clients.SYSTEM_ADMIN.patch(`/api/users/${me.id}`, { roleId: await roleId(prisma, 'SALES'), version: me.version });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LAST_ADMIN');
    expect((await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } })).roleId).toBe(me.roleId);
  });
});

describe('user management rules', () => {
  it('rejects duplicate usernames regardless of case', async () => {
    const res = await clients.SYSTEM_ADMIN.post('/api/users', { username: 'Store', fullName: 'تكرار', roleId: await roleId(prisma, 'SALES'), password: 'Dup-Pass-2026' });
    // الاسم بيتحول لحروف صغيرة قبل الحفظ، فبيتقفش كتكرار
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE');
  });

  it('warns when two people edit the same user at the same time', async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { username: 'quality' } });
    const first = await clients.SYSTEM_ADMIN.patch(`/api/users/${u.id}`, { fullName: 'د. منى السيد علي', version: u.version });
    expect(first.status).toBe(200);
    const second = await clients.SYSTEM_ADMIN.patch(`/api/users/${u.id}`, { fullName: 'اسم قديم', version: u.version });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('STALE_VERSION');
  });

  it('password reset forces a change on next login and kills open sessions', async () => {
    const worker = await login(app, 'maint');
    const u = await prisma.user.findUniqueOrThrow({ where: { username: 'maint' } });
    expect((await clients.SYSTEM_ADMIN.post(`/api/users/${u.id}/reset-password`, { newPassword: 'Reset-Pass-2026' })).status).toBe(204);
    expect((await worker.get('/api/auth/me')).status).toBe(401);
    const again = await login(app, 'maint', 'Reset-Pass-2026');
    expect(again.profile.stage).toBe('password_change');
  });

  it('never returns password hashes or secrets', async () => {
    const res = await clients.SYSTEM_ADMIN.get('/api/users?pageSize=200');
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/argon2|passwordHash|mfaSecret|phoneEnc/);
  });
});
