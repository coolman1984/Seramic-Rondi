import { Module } from '@nestjs/common';
import { MasterDataController } from './masterdata.controller';
import { MasterDataService } from './masterdata.service';

@Module({ providers: [MasterDataService], controllers: [MasterDataController] })
export class MasterDataModule {}
