import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, PipeTransform, Post, Query, Injectable } from '@nestjs/common';
import { listQuerySchema, MASTER_DATA_KINDS, type ListQuery, type MasterDataKind } from '@rondi/shared';
import { CurrentAuth, Meta, RequirePermissions } from '../common/decorators';
import { AppError } from '../common/errors';
import { HttpStatus } from '@nestjs/common';
import type { RequestMeta } from '../common/request';
import { versioned, versionField } from '../common/versioned';
import { ZodPipe } from '../common/zod.pipe';
import type { AuthContext } from '../auth/auth.types';
import { MasterDataService } from './masterdata.service';
import { schemaFor } from './registry';

@Injectable()
class KindPipe implements PipeTransform<string, MasterDataKind> {
  transform(value: string): MasterDataKind {
    if (!(MASTER_DATA_KINDS as string[]).includes(value)) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'القائمة دي مش موجودة');
    return value as MasterDataKind;
  }
}

const actorOf = (a: AuthContext) => ({ userId: a.userId, name: a.fullName });

@Controller('master')
export class MasterDataController {
  constructor(private readonly svc: MasterDataService) {}

  @Get('options')
  @RequirePermissions('masterdata.read')
  options() {
    return this.svc.options();
  }

  @Get(':kind')
  @RequirePermissions('masterdata.read')
  list(@Param('kind', KindPipe) kind: MasterDataKind, @Query(new ZodPipe(listQuerySchema)) q: ListQuery) {
    return this.svc.list(kind, q);
  }

  @Get(':kind/:id')
  @RequirePermissions('masterdata.read')
  get(@Param('kind', KindPipe) kind: MasterDataKind, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.get(kind, id);
  }

  @Post(':kind')
  @RequirePermissions('masterdata.manage')
  create(@Param('kind', KindPipe) kind: MasterDataKind, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @Meta() meta: RequestMeta) {
    const data = new ZodPipe(schemaFor(kind)).transform(body) as Record<string, unknown>;
    return this.svc.create(kind, data, actorOf(auth), meta);
  }

  @Patch(':kind/:id')
  @RequirePermissions('masterdata.manage')
  update(
    @Param('kind', KindPipe) kind: MasterDataKind,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentAuth() auth: AuthContext,
    @Meta() meta: RequestMeta,
  ) {
    const data = new ZodPipe(versioned(schemaFor(kind))).transform(body) as Record<string, unknown> & { version: number };
    return this.svc.update(kind, id, data, actorOf(auth), meta);
  }

  @Post(':kind/:id/deactivate')
  @HttpCode(200)
  @RequirePermissions('masterdata.manage')
  deactivate(@Param('kind', KindPipe) kind: MasterDataKind, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodPipe(versionField)) body: { version: number }, @CurrentAuth() auth: AuthContext, @Meta() meta: RequestMeta) {
    return this.svc.setActive(kind, id, false, body.version, actorOf(auth), meta);
  }

  @Post(':kind/:id/activate')
  @HttpCode(200)
  @RequirePermissions('masterdata.manage')
  activate(@Param('kind', KindPipe) kind: MasterDataKind, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodPipe(versionField)) body: { version: number }, @CurrentAuth() auth: AuthContext, @Meta() meta: RequestMeta) {
    return this.svc.setActive(kind, id, true, body.version, actorOf(auth), meta);
  }
}
