import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FundraisingStats } from './fundraising-stats.entity';
import { Supporter } from './supporter.entity';
import { CustomerStats } from './customer-stats.entity';
import { GrandPrizeEntry } from './grand-prize-entry.entity';
import { FundraisingService } from './fundraising.service';
import { FundraisingController } from './fundraising.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FundraisingStats, Supporter, CustomerStats, GrandPrizeEntry])],
  controllers: [FundraisingController],
  providers: [FundraisingService],
  exports: [FundraisingService],
})
export class FundraisingModule {}
