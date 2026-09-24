import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({ imports: [UsersModule], providers: [RolesService], controllers: [RolesController] })
export class RolesModule {}
