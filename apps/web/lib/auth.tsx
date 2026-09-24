'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Permission } from '@rondi/shared';
import { api, setCsrfToken } from './api';

export type Stage = 'mfa_verify' | 'password_change' | 'mfa_setup' | 'active';

export interface Me {
  user: { id: string; username: string; fullName: string; role: { code: string; name: string } };
  permissions: Permission[];
  stage: Stage;
  csrfToken: string;
  mfaEnabled: boolean;
  mfaRequired: boolean;
}

export async function fetchMe(): Promise<Me> {
  const me = await api.get<Me>('/auth/me');
  setCsrfToken(me.csrfToken);
  return me;
}

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: fetchMe, staleTime: 60_000, retry: false });
}

export function useCan() {
  const { data } = useMe();
  return (...perms: Permission[]) => !!data && perms.every((p) => data.permissions.includes(p));
}

export function useSetMe() {
  const qc = useQueryClient();
  return (me: Me | null) => {
    setCsrfToken(me?.csrfToken ?? null);
    if (me) qc.setQueryData(['me'], me);
    else qc.clear();
  };
}
