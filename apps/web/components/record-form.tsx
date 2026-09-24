'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import type { z } from 'zod';
import { ApiError } from '@/lib/api';
import { Alert, Field, Input, Select } from './ui';
import type { FieldDef } from '@/lib/master-config';

type Values = Record<string, unknown>;

/** بيفحص البيانات على نفس قواعد الخادم قبل ما تتبعت، ويرجّع خطأ لكل خانة. */
export function validate(schema: z.ZodType, values: Values): { ok: true; data: Values } | { ok: false; fields: Record<string, string> } {
  const res = schema.safeParse(values);
  if (res.success) return { ok: true, data: res.data as Values };
  const fields: Record<string, string> = {};
  for (const issue of res.error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    fields[key] ??= issue.message;
  }
  return { ok: false, fields };
}

export function useRecordForm(initial: Values) {
  const [values, setValues] = useState<Values>(initial);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (name: string, value: unknown) => {
    setValues((v) => ({ ...v, [name]: value }));
    setFields((f) => {
      if (!f[name]) return f;
      const { [name]: _removed, ...rest } = f;
      void _removed;
      return rest;
    });
  };

  const run = async (schema: z.ZodType, action: (data: Values) => Promise<void>, e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    const v = validate(schema, values);
    if (!v.ok) {
      setFields(v.fields);
      setError(v.fields._ ?? 'في بيانات محتاجة تتصلح');
      return;
    }
    setBusy(true);
    try {
      await action(v.data);
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        setError(err.message);
      } else setError('حصلت مشكلة. جرب تاني.');
    } finally {
      setBusy(false);
    }
  };

  return { values, set, fields, error, busy, run, setValues, setError };
}

export function FieldInput({
  def,
  value,
  onChange,
  error,
  refOptions,
  disabled,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  refOptions?: Array<{ id: string; label: string }>;
  disabled?: boolean;
}) {
  const id = `f-${def.name}`;
  const str = value === null || value === undefined ? '' : String(value);
  let control: ReactNode;
  switch (def.type) {
    case 'select':
      control = (
        <Select id={id} value={str} onChange={(e) => onChange(e.target.value)} invalid={!!error} disabled={disabled}>
          {Object.entries(def.options ?? {}).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
      );
      break;
    case 'ref':
      control = (
        <Select id={id} value={str} onChange={(e) => onChange(e.target.value || null)} invalid={!!error} disabled={disabled}>
          <option value="">{def.optional ? '— بدون —' : 'اختار…'}</option>
          {(refOptions ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
      );
      break;
    case 'textarea':
      control = (
        <textarea
          id={id}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          disabled={disabled}
          className="w-full rounded-[10px] border border-line bg-panel px-3 py-2 text-[14.5px] outline-none focus:border-accent focus:ring-3 focus:ring-accent/15"
        />
      );
      break;
    case 'time':
      control = <Input id={id} type="time" dir="ltr" value={str} onChange={(e) => onChange(e.target.value)} invalid={!!error} disabled={disabled} />;
      break;
    case 'number':
      control = <Input id={id} inputMode="decimal" dir="ltr" className="text-left tabular" value={str} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} invalid={!!error} disabled={disabled} />;
      break;
    case 'code':
      control = <Input id={id} dir="auto" autoCapitalize="characters" spellCheck={false} value={str} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} invalid={!!error} disabled={disabled} />;
      break;
    default:
      control = <Input id={id} value={str} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} invalid={!!error} disabled={disabled} />;
  }
  return (
    <Field label={def.label} htmlFor={id} error={error} hint={def.hint} required={!def.optional}>
      {control}
    </Field>
  );
}

export function FormError({ error, fields }: { error: string | null; fields: Record<string, string> }) {
  if (!error) return null;
  // لو الأخطاء متوضحة جنب الخانات، رسالة عامة صغيرة كفاية
  return <Alert>{Object.keys(fields).length > 0 ? 'صلّح الخانات اللي باللون الأحمر.' : error}</Alert>;
}
