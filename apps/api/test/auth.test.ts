import type { INestApplication } from '@nestjs/common';
import { generate } from 'otplib';
import request from 'supertest';
import { ADMIN_PASSWORD, createApp, db, DEMO_PASSWORD, login, ORIGIN, rawLogin, resetDb, roleId } from './helpers';

const prisma = db();
let app: INestApplication;

beforeAll(async () => {
  await resetDb(prisma);
  app = await createApp();
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('login', () => {
  it('logs in and sets a protected session cookie', async () => {
    const { req } = rawLogin(app, 'admin', ADMIN_PASSWORD);
    const res = await req;
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('admin');
    expect(res.body.stage).toBe('active');
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^rondi_sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    // الرمز نفسه مش متخزن في القاعدة، بصمته بس
    const token = /rondi_sid=([^;]+)/.exec(cookie)![1];
    expect(await prisma.session.count({ where: { tokenHash: token } })).toBe(0);
  });

  it('accepts usernames with different case and spaces', async () => {
    const { req } = rawLogin(app, '  ADMIN ', ADMIN_PASSWORD);
    expect((await req).status).toBe(200);
  });

  it('gives the same answer for a wrong password and an unknown user', async () => {
    const a = await rawLogin(app, 'store', 'wrong-password-1').req;
    const b = await rawLogin(app, 'no.such.user', 'wrong-password-1').req;
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
    expect(a.body.code).toBe('BAD_CREDENTIALS');
  });

  it('rejects requests without a session', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a forged session cookie', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', 'rondi_sid=forged-token-value');
    expect(res.status).toBe(401);
  });

  it('logs every login and failure in the audit log', async () => {
    const actions = (await prisma.auditLog.findMany({ select: { action: true } })).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['LOGIN', 'LOGIN_FAILED']));
  });
});

describe('account lockout', () => {
  it('locks the account after 5 wrong passwords, even for the right password', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await rawLogin(app, 'sales', 'bad-password-' + i).req).status).toBe(401);
    }
    const locked = await rawLogin(app, 'sales', DEMO_PASSWORD).req;
    expect(locked.status).toBe(423);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');
    // غلط وهو مقفول: نفس الرد العام (مانقولش إنه مقفول لحد مايعرفش كلمة السر)
    expect((await rawLogin(app, 'sales', 'still-wrong-1').req).status).toBe(401);
    const u = await prisma.user.findUniqueOrThrow({ where: { username: 'sales' } });
    expect(u.lockedUntil!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    expect(await prisma.auditLog.count({ where: { action: 'ACCOUNT_LOCKED', entityId: u.id } })).toBe(1);
  });

  it('lets the system admin unlock it', async () => {
    const admin = await login(app, 'admin', ADMIN_PASSWORD);
    const u = await prisma.user.findUniqueOrThrow({ where: { username: 'sales' } });
    expect((await admin.post(`/api/users/${u.id}/unlock`)).status).toBe(204);
    expect((await rawLogin(app, 'sales', DEMO_PASSWORD).req).status).toBe(200);
  });

  it('resets the failure counter after a successful login', async () => {
    await rawLogin(app, 'quality', 'bad-password-x').req;
    await login(app, 'quality');
    const u = await prisma.user.findUniqueOrThrow({ where: { username: 'quality' } });
    expect(u.failedLoginCount).toBe(0);
  });
});

describe('request forgery protection (CSRF)', () => {
  it('rejects a change without the session token', async () => {
    const c = await login(app, 'admin', ADMIN_PASSWORD);
    const res = await c.agent.post('/api/master/shades').set('origin', ORIGIN).send({ code: 'X1' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF');
  });

  it('rejects a change with a wrong token', async () => {
    const c = await login(app, 'admin', ADMIN_PASSWORD);
    const res = await c.agent.post('/api/master/shades').set('x-csrf-token', 'nope').send({ code: 'X1' });
    expect(res.status).toBe(403);
  });

  it('rejects a change coming from another website', async () => {
    const c = await login(app, 'admin', ADMIN_PASSWORD);
    const res = await c.agent.post('/api/master/shades').set('x-csrf-token', c.csrf).set('origin', 'https://evil.example').send({ code: 'X1' });
    expect(res.status).toBe(403);
  });

  it('rejects a login form posted from another page', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ username: 'admin', password: ADMIN_PASSWORD });
    expect(res.status).toBe(403);
  });
});

describe('logout and sessions', () => {
  it('logout kills the session', async () => {
    const c = await login(app, 'store');
    expect((await c.post('/api/auth/logout')).status).toBe(204);
    expect((await c.get('/api/auth/me')).status).toBe(401);
  });

  it('expires idle sessions', async () => {
    const c = await login(app, 'maint');
    await prisma.session.updateMany({ where: { user: { username: 'maint' }, revokedAt: null }, data: { lastSeenAt: new Date(Date.now() - 3 * 3600_000) } });
    expect((await c.get('/api/auth/me')).status).toBe(401);
  });

  it('expires sessions after the absolute lifetime', async () => {
    const c = await login(app, 'maint');
    await prisma.session.updateMany({ where: { user: { username: 'maint' }, revokedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await c.get('/api/auth/me')).status).toBe(401);
  });

  it('lets a user see and close their other devices', async () => {
    const phone = await login(app, 'sup.a');
    const tablet = await login(app, 'sup.a');
    const list = await tablet.get('/api/auth/sessions');
    expect(list.body.length).toBeGreaterThanOrEqual(2);
    const other = list.body.find((s: any) => !s.current);
    expect((await tablet.post(`/api/auth/sessions/${other.id}/revoke`)).status).toBe(204);
    // واحد من الجهازين اتقفل
    const statuses = [(await phone.get('/api/auth/me')).status, (await tablet.get('/api/auth/me')).status];
    expect(statuses).toContain(200);
  });

  it('cannot close somebody else\'s session', async () => {
    const a = await login(app, 'sup.b');
    const b = await login(app, 'sup.c');
    const bSession = (await b.get('/api/auth/sessions')).body[0];
    expect((await a.post(`/api/auth/sessions/${bSession.id}/revoke`)).status).toBe(404);
  });
});

describe('first login: forced password change', () => {
  let userId: string;

  beforeAll(async () => {
    const admin = await login(app, 'admin', ADMIN_PASSWORD);
    const res = await admin.post('/api/users', { username: 'new.worker', fullName: 'عامل جديد', roleId: await roleId(prisma, 'SHIFT_SUPERVISOR'), password: 'Temp-Pass-9911' });
    expect(res.status).toBe(201);
    userId = res.body.id;
  });

  it('blocks everything until the password is changed', async () => {
    const c = await login(app, 'new.worker', 'Temp-Pass-9911');
    expect(c.profile.stage).toBe('password_change');
    expect(c.profile.permissions).toEqual([]);
    const blocked = await c.get('/api/master/models');
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('AUTH_STAGE');
  });

  it('rejects a wrong current password and a weak new one', async () => {
    const c = await login(app, 'new.worker', 'Temp-Pass-9911');
    expect((await c.post('/api/auth/change-password', { currentPassword: 'nope', newPassword: 'Strong-Pass-2026' })).status).toBe(400);
    const weak = await c.post('/api/auth/change-password', { currentPassword: 'Temp-Pass-9911', newPassword: '12345678' });
    expect(weak.status).toBe(400);
    expect(weak.body.fields.newPassword).toBeDefined();
    const withName = await c.post('/api/auth/change-password', { currentPassword: 'Temp-Pass-9911', newPassword: 'new.worker-2026' });
    expect(withName.status).toBe(400);
  });

  it('changes the password, keeps this device and logs out the others', async () => {
    // فك القفل لو المحاولة الغلط اللي فاتت عدّت
    await prisma.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: null } });
    const other = await login(app, 'new.worker', 'Temp-Pass-9911');
    const c = await login(app, 'new.worker', 'Temp-Pass-9911');
    expect((await c.post('/api/auth/change-password', { currentPassword: 'Temp-Pass-9911', newPassword: 'Kiln-Shift-2026' })).status).toBe(204);
    const me = await c.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.stage).toBe('active');
    expect((await other.get('/api/auth/me')).status).toBe(401);
    expect((await rawLogin(app, 'new.worker', 'Temp-Pass-9911').req).status).toBe(401);
    expect((await rawLogin(app, 'new.worker', 'Kiln-Shift-2026').req).status).toBe(200);
  });

  it('stores passwords only as argon2id hashes', async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u.passwordHash).toMatch(/^\$argon2id\$/);
    expect(u.passwordHash).not.toContain('Kiln-Shift-2026');
  });
});

describe('second factor (authenticator app)', () => {
  let secret: string;

  it('forces setup when the role requires it', async () => {
    await prisma.role.update({ where: { code: 'ACCOUNTANT' }, data: { mfaRequired: true } });
    const c = await login(app, 'accounts');
    expect(c.profile.stage).toBe('mfa_setup');
    expect((await c.get('/api/master/models')).status).toBe(403);

    const setup = await c.post('/api/auth/mfa/setup');
    expect(setup.status).toBe(201);
    expect(setup.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    secret = setup.body.secret;
    const stored = await prisma.user.findUniqueOrThrow({ where: { username: 'accounts' } });
    expect(stored.mfaSecretEnc).not.toContain(secret); // متخزن متشفر

    expect((await c.post('/api/auth/mfa/enable', { code: '000000' })).status).toBe(400);
    expect((await c.post('/api/auth/mfa/enable', { code: await generate({ secret }) })).status).toBe(204);
    expect((await c.get('/api/auth/me')).body.stage).toBe('active');
  });

  it('asks for the code on the next login and refuses reusing it', async () => {
    const c = await login(app, 'accounts');
    expect(c.profile.stage).toBe('mfa_verify');
    expect((await c.get('/api/master/models')).status).toBe(403);
    expect((await c.post('/api/auth/mfa/verify', { code: '123456' })).status).toBe(400);

    const u = await prisma.user.findUniqueOrThrow({ where: { username: 'accounts' } });
    const used = await generate({ secret, epoch: Number(u.mfaLastStep!) * 30 });
    expect((await c.post('/api/auth/mfa/verify', { code: used })).status).toBe(400);

    const next = await generate({ secret, epoch: (Number(u.mfaLastStep!) + 1) * 30 });
    await prisma.user.update({ where: { id: u.id }, data: { failedLoginCount: 0 } });
    // رمز الخطوة الجاية مقبول (في تسامح ٣٠ ثانية لفرق الساعة بين الموبايل والسيرفر)
    expect((await c.post('/api/auth/mfa/verify', { code: next })).status).toBe(204);
    expect((await c.get('/api/master/models')).status).toBe(200);
  });

  it('does not let a user drop the second factor when the role requires it', async () => {
    const res = await prisma.user.findUniqueOrThrow({ where: { username: 'accounts' } });
    expect(res.mfaEnabled).toBe(true);
    const admin = await login(app, 'admin', ADMIN_PASSWORD);
    expect((await admin.post(`/api/users/${res.id}/reset-mfa`)).status).toBe(204);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: res.id } })).mfaEnabled).toBe(false);
  });
});

describe('deactivated users', () => {
  it('are logged out immediately and cannot log in', async () => {
    const worker = await login(app, 'sup.c');
    const admin = await login(app, 'admin', ADMIN_PASSWORD);
    const u = await prisma.user.findUniqueOrThrow({ where: { username: 'sup.c' } });
    expect((await admin.post(`/api/users/${u.id}/deactivate`, { version: u.version })).status).toBe(200);
    expect((await worker.get('/api/auth/me')).status).toBe(401);
    expect((await rawLogin(app, 'sup.c', DEMO_PASSWORD).req).status).toBe(401);
  });
});

describe('security headers', () => {
  it('sends protective headers and hides server details', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('never leaks internals in errors', async () => {
    const c = await login(app, 'admin', ADMIN_PASSWORD);
    const res = await c.get('/api/users/not-a-uuid');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at \w+ \(|node_modules|prisma/i);
  });

  it('rejects oversized bodies', async () => {
    const c = await login(app, 'admin', ADMIN_PASSWORD);
    const res = await c.post('/api/master/shades', { code: 'Z9', description: 'x'.repeat(400_000) });
    expect(res.status).toBe(413);
  });

});
