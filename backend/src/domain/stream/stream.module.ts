import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreamQueue } from './stream-queue.entity';
import { StreamEvent } from './stream-event.entity';
import { Supporter } from '../fundraising/supporter.entity';
import { StreamService } from './stream.service';
import { StreamController } from './stream.controller';
import { FundraisingModule } from '../fundraising/fundraising.module';
import { PhotoModule } from '../photo/photo.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StreamQueue, StreamEvent, Supporter]),
    forwardRef(() => FundraisingModule),
    PhotoModule,
    NotificationModule,
  ],
  controllers: [StreamController],
  providers: [StreamService],
  exports: [StreamService],
})
export class StreamModule {}
