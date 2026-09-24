import { Controller, Get, Query } from '@nestjs/common';
import { auditQuerySchema, type AuditQuery } from '@rondi/shared';
import { RequirePermissions } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  list(@Query(new ZodPipe(auditQuerySchema)) q: AuditQuery) {
    return this.audit.list(q);
  }

  @Get('verify')
  @RequirePermissions('audit.read')
  verify() {
    return this.audit.verifyChain();
  }
}
