import {
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  loginSchema,
  materialSchema,
  newPassword,
  normalizeDigits,
  parseLooseNumber,
  roleUpdateSchema,
  shiftSchema,
  sizeLabel,
  sqmPerCarton,
  sqmPerPallet,
  userCreateSchema,
  code,
  text,
} from './index';

describe('digits', () => {
  it('converts Arabic-Indic and Persian digits', () => {
    expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(normalizeDigits('۱۲۳')).toBe('123');
    expect(normalizeDigits('ب٣')).toBe('ب3');
  });
  it('parses loose numbers with Arabic separators', () => {
    expect(parseLooseNumber('١٬٢٥٠٫٥')).toBe(1250.5);
    expect(parseLooseNumber('1,250.5')).toBe(1250.5);
    expect(parseLooseNumber(' 42 ')).toBe(42);
    expect(parseLooseNumber('12abc')).toBeNaN();
    expect(parseLooseNumber('')).toBeNaN();
  });
});

describe('packaging math', () => {
  it('computes m² per carton for common Egyptian sizes', () => {
    expect(sqmPerCarton(600, 600, 4)).toBe(1.44);
    expect(sqmPerCarton(400, 250, 10)).toBe(1);
    expect(sqmPerCarton(450, 450, 6)).toBe(1.215);
    expect(sqmPerCarton(1200, 600, 2)).toBe(1.44);
  });
  it('computes m² per pallet', () => {
    expect(sqmPerPallet(600, 600, 4, 40)).toBe(57.6);
  });
  it('labels sizes in cm', () => {
    expect(sizeLabel(600, 600)).toBe('60×60');
    expect(sizeLabel(600, 300)).toBe('30×60');
    expect(sizeLabel(1200, 600)).toBe('60×120');
  });
});

describe('default roles follow the approved matrix', () => {
  const role = (c: string) => DEFAULT_ROLES.find((r) => r.code === c)!;
  it('has the 9 factory roles plus system admin', () => {
    expect(DEFAULT_ROLES).toHaveLength(10);
  });
  it('only uses known permissions', () => {
    for (const r of DEFAULT_ROLES) for (const p of r.permissions) expect(ALL_PERMISSIONS).toContain(p);
  });
  it('shift supervisor records production but cannot see costing or sales', () => {
    const r = role('SHIFT_SUPERVISOR');
    expect(r.permissions).toEqual(expect.arrayContaining(['production.read', 'production.write', 'maintenance.report']));
    expect(r.permissions).not.toContain('costing.read');
    expect(r.permissions).not.toContain('sales.read');
    expect(r.permissions).not.toContain('maintenance.write');
    expect(r.permissions).not.toContain('users.manage');
  });
  it('storekeeper writes stock and shipping only', () => {
    const w = role('STOREKEEPER').permissions.filter((p) => p.endsWith('.write'));
    expect(w.sort()).toEqual(['fgstock.write', 'rmstock.write', 'shipping.write']);
  });
  it('only the system admin manages users and roles', () => {
    for (const r of DEFAULT_ROLES) {
      const admin = r.code === 'SYSTEM_ADMIN';
      expect(r.permissions.includes('users.manage')).toBe(admin);
      expect(r.permissions.includes('roles.manage')).toBe(admin);
    }
  });
  it('costing is written by accounts only', () => {
    for (const r of DEFAULT_ROLES) expect(r.permissions.includes('costing.write')).toBe(r.code === 'ACCOUNTANT');
  });
});

describe('validation', () => {
  it('normalizes login username', () => {
    expect(loginSchema.parse({ username: '  Ahmed.Ali ', password: 'x' }).username).toBe('ahmed.ali');
  });
  it('rejects weak or common passwords', () => {
    expect(newPassword.safeParse('1234567').success).toBe(false);
    expect(newPassword.safeParse('12345678').success).toBe(false);
    expect(newPassword.safeParse('aaaaaaab').success).toBe(false);
    expect(newPassword.safeParse('Kiln-Line2-2026').success).toBe(true);
  });
  it('validates new users', () => {
    const base = { username: 'sup.b', fullName: 'محمود عبد الله', roleId: '3f1f6f7e-8c43-4c5b-9a53-3b1c8d2f0a11', password: 'Shift-B-2026' };
    expect(userCreateSchema.safeParse(base).success).toBe(true);
    expect(userCreateSchema.safeParse({ ...base, username: 'محمود' }).success).toBe(false);
    expect(userCreateSchema.parse({ ...base, phone: '٠١٠٠ ١٢٣ ٤٥٦٧' }).phone).toBe('01001234567');
    expect(userCreateSchema.safeParse({ ...base, phone: '12' }).success).toBe(false);
  });
  it('rejects unknown permissions', () => {
    expect(roleUpdateSchema.safeParse({ permissions: ['production.read', 'hack.all'] }).success).toBe(false);
    expect(roleUpdateSchema.parse({ permissions: ['production.read', 'production.read'] }).permissions).toEqual(['production.read']);
  });
  it('accepts Arabic digits in numbers and codes', () => {
    const m = materialSchema.parse({ code: 'fr-w', name: 'فريت أبيض', category: 'GLAZE', unit: 'TON', minStock: '١٢٫٥', leadTimeDays: '١٤' });
    expect(m.code).toBe('FR-W');
    expect(m.minStock).toBe(12.5);
    expect(m.leadTimeDays).toBe(14);
    expect(code().parse('ب٣')).toBe('ب3');
  });
  it('rejects invisible control / bidi characters in text', () => {
    expect(text(1, 50).safeParse('فرن‮1').success).toBe(false);
    expect(text(1, 50).safeParse('  فرن ١  ').success).toBe(true);
  });
  it('validates shift times', () => {
    expect(shiftSchema.safeParse({ code: 'ج', name: 'الوردية ج', startTime: '٢٢:٠٠', endTime: '06:00' }).success).toBe(true);
    expect(shiftSchema.safeParse({ code: 'ج', name: 'الوردية ج', startTime: '25:00', endTime: '06:00' }).success).toBe(false);
  });
});
