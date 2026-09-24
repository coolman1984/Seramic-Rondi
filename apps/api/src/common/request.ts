import type { Request } from 'express';
import type { AuthContext } from '../auth/auth.types';

export interface RequestMeta {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
}

export interface RequestWithAuth extends Request {
  auth?: AuthContext;
  meta: RequestMeta;
}
