import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { env } from './config/env';
import { AllExceptionsFilter } from './common/exception.filter';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard, CsrfGuard, PermissionsGuard } from './auth/guards';
import { HealthController } from './health.controller';
import { MasterDataModule } from './masterdata/masterdata.module';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: () => env().THROTTLE_LIMIT_PER_MINUTE }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesModule,
    MasterDataModule,
  ],
  controllers: [HealthController],
  providers: [
    // الترتيب مهم: عدد الطلبات ← مين انت ← الطلب من شاشاتنا؟ ← مسموح لك؟
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
