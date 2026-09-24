import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  listQuerySchema,
  resetPasswordSchema,
  userCreateSchema,
  userUpdateSchema,
  type ListQuery,
  type ResetPasswordInput,
  type UserCreateInput,
  type UserUpdateInput,
} from '@rondi/shared';
import { CurrentAuth, Meta, RequirePermissions } from '../common/decorators';
import type { RequestMeta } from '../common/request';
import { versioned, versionField } from '../common/versioned';
import { ZodPipe } from '../common/zod.pipe';
import type { AuthContext } from '../auth/auth.types';
import { UsersService } from './users.service';

const actorOf = (a: AuthContext) => ({ userId: a.userId, name: a.fullName });

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('users.read')
  list(@Query(new ZodPipe(listQuerySchema)) q: ListQuery, @CurrentAuth() auth: AuthContext) {
    return this.users.list(q, auth.permissions.has('users.manage'));
  }

  @Get(':id')
  @RequirePermissions('users.read')
  get(@Param('id', new ParseUUIDPipe()) id: string, @CurrentAuth() auth: AuthContext) {
    return this.users.get(id, auth.permissions.has('users.manage'));
  }

  @Post()
  @RequirePermissions('users.manage')
  create(@Body(new ZodPipe(userCreateSchema)) body: UserCreateInput, @CurrentAuth() auth: AuthContext, @Meta() meta: RequestMeta) {
    return this.users.create(body, actorOf(auth), meta);
  }

  @Patch(':id')
  @RequirePermissions('users.manage')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(versioned(userUpdateSchema))) body: UserUpdateInput & { version: number },
    @CurrentAuth() auth: AuthContext,
    @Meta() meta: RequestMeta,
  ) {
    return this.users.update(id, body, actorOf(auth), meta);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequirePermissions('users.manage')
  deactivate(@Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodPipe(versionField)) body: { version: number }, @CurrentAuth() auth: AuthContext, @Meta() meta: RequestMeta) {
    return this.users.setActive(id, false, body.version, actorOf(auth), meta);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @RequirePermissions('users.manage')
  activate(@Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodPipe(versionField)) body: { version: number }, @CurrentAuth() auth: AuthContext, @Meta() meta: RequestMeta) {
    return this.users.setActive(id, true, body.version, actorOf(auth), meta);
  }

  @Post(':id/reset-password')
  @HttpCode(204)
  @RequirePermissions('users.manage')
  resetPassword(@Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodPipe(resetPasswordSchema)) body: ResetPasswordInput, @CurrentAuth() auth: AuthContext, @Meta() meta: RequestMeta) {
    return this.users.resetPassword(id, body.newPassword, actorOf(auth), meta);
  }

  @Post(':id/unlock')
  @HttpCode(204)
  @RequirePermissions('users.manage')
  unlock(@Param('id', new ParseUUIDPipe()) id: string, @CurrentAuth() auth: AuthContext, @Meta() meta: RequestMeta) {
    return this.users.unlock(id, actorOf(auth), meta);
  }

  @Post(':id/reset-mfa')
  @HttpCode(204)
  @RequirePermissions('users.manage')
  resetMfa(@Param('id', new ParseUUIDPipe()) id: string, @CurrentAuth() auth: AuthContext, @Meta() meta: RequestMeta) {
    return this.users.resetMfa(id, actorOf(auth), meta);
  }
}
