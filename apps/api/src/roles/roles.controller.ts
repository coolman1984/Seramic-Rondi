import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { roleCreateSchema, roleUpdateSchema, type RoleCreateInput, type RoleUpdateInput } from '@rondi/shared';
import { CurrentAuth, Meta, RequirePermissions } from '../common/decorators';
import type { RequestMeta } from '../common/request';
import { versioned } from '../common/versioned';
import { ZodPipe } from '../common/zod.pipe';
import type { AuthContext } from '../auth/auth.types';
import { RolesService } from './roles.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermissions('users.read')
  list() {
    return this.roles.list();
  }

  @Post()
  @RequirePermissions('roles.manage')
  create(@Body(new ZodPipe(roleCreateSchema)) body: RoleCreateInput, @CurrentAuth() auth: AuthContext, @Meta() meta: RequestMeta) {
    return this.roles.create(body, { userId: auth.userId, name: auth.fullName }, meta);
  }

  @Patch(':id')
  @RequirePermissions('roles.manage')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodPipe(versioned(roleUpdateSchema))) body: RoleUpdateInput & { version: number },
    @CurrentAuth() auth: AuthContext,
    @Meta() meta: RequestMeta,
  ) {
    return this.roles.update(id, body, { userId: auth.userId, name: auth.fullName }, meta);
  }
}
