import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Global()
@Module({
  providers: [AuthService, PasswordService, SessionService, MfaService],
  controllers: [AuthController],
  exports: [PasswordService, SessionService],
})
export class AuthModule {}
