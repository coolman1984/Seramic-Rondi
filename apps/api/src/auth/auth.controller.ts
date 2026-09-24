import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  changePasswordSchema,
  loginSchema,
  mfaCodeSchema,
  mfaDisableSchema,
  type ChangePasswordInput,
  type LoginInput,
  type MfaCodeInput,
} from '@rondi/shared';
import { env } from '../config/env';
import { AllowStages, CurrentAuth, Meta, Public } from '../common/decorators';
import type { RequestMeta } from '../common/request';
import { ZodPipe } from '../common/zod.pipe';
import { AuthService } from './auth.service';
import type { AuthContext } from './auth.types';
import { SessionService } from './session.service';

// الحد بيتقري وقت الطلب نفسه من الإعدادات
const loginLimit = () => ({ default: { limit: () => env().THROTTLE_LOGIN_PER_MINUTE, ttl: 60_000 } });

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly sessions: SessionService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle(loginLimit())
  async login(@Body(new ZodPipe(loginSchema)) body: LoginInput, @Meta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const { token, expiresAt } = await this.auth.login(body, meta);
    this.sessions.setCookie(res, token, expiresAt);
    const ctx = await this.sessions.resolve(token);
    return this.auth.profile(ctx!);
  }

  @Post('logout')
  @HttpCode(204)
  @AllowStages('mfa_verify', 'password_change', 'mfa_setup')
  async logout(@CurrentAuth() auth: AuthContext, @Meta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(auth, meta);
    this.sessions.clearCookie(res);
  }

  @Get('me')
  @AllowStages('mfa_verify', 'password_change', 'mfa_setup')
  me(@CurrentAuth() auth: AuthContext) {
    return this.auth.profile(auth);
  }

  @Post('change-password')
  @HttpCode(204)
  @Throttle(loginLimit())
  @AllowStages('password_change')
  changePassword(@CurrentAuth() auth: AuthContext, @Body(new ZodPipe(changePasswordSchema)) body: ChangePasswordInput, @Meta() meta: RequestMeta) {
    return this.auth.changePassword(auth, body, meta);
  }

  @Post('mfa/setup')
  @AllowStages('mfa_setup')
  mfaSetup(@CurrentAuth() auth: AuthContext) {
    return this.auth.mfaSetup(auth);
  }

  @Post('mfa/enable')
  @HttpCode(204)
  @Throttle(loginLimit())
  @AllowStages('mfa_setup')
  mfaEnable(@CurrentAuth() auth: AuthContext, @Body(new ZodPipe(mfaCodeSchema)) body: MfaCodeInput, @Meta() meta: RequestMeta) {
    return this.auth.mfaEnable(auth, body.code, meta);
  }

  @Post('mfa/verify')
  @HttpCode(204)
  @Throttle(loginLimit())
  @AllowStages('mfa_verify')
  mfaVerify(@CurrentAuth() auth: AuthContext, @Body(new ZodPipe(mfaCodeSchema)) body: MfaCodeInput, @Meta() meta: RequestMeta) {
    return this.auth.mfaVerify(auth, body.code, meta);
  }

  @Post('mfa/disable')
  @HttpCode(204)
  @Throttle(loginLimit())
  mfaDisable(@CurrentAuth() auth: AuthContext, @Body(new ZodPipe(mfaDisableSchema)) body: { password: string }, @Meta() meta: RequestMeta) {
    return this.auth.mfaDisable(auth, body.password, meta);
  }

  @Get('sessions')
  listSessions(@CurrentAuth() auth: AuthContext) {
    return this.auth.listSessions(auth);
  }

  @Post('sessions/:id/revoke')
  @HttpCode(204)
  revokeSession(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Meta() meta: RequestMeta) {
    return this.auth.revokeSession(auth, id, meta);
  }
}
