import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';

import { S3Module } from './common/services/s3.module';
import { AuthModule } from './domain/auth/auth.module';
import { FundraisingModule } from './domain/fundraising/fundraising.module';
import { PhotoModule } from './domain/photo/photo.module';
import { PaymentModule } from './domain/payment/payment.module';
import { StreamModule } from './domain/stream/stream.module';
import { MerchandiseModule } from './domain/merchandise/merchandise.module';
import { NotificationModule } from './domain/notification/notification.module';
import { AdminModule } from './domain/admin/admin.module';
import { HealthModule } from './domain/health/health.module';
import { SettingsModule } from './domain/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    S3Module,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 10124),
        username: config.get('DB_USER', 'root'),
        password: config.get('DB_PASSWORD', 'root'),
        database: config.get('DB_NAME', 'fundraising_db'),
        socketPath: config.get('DB_SOCKET'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') === 'development',
        logging: false,
      }),
    }),
    AuthModule,
    FundraisingModule,
    PhotoModule,
    PaymentModule,
    StreamModule,
    MerchandiseModule,
    NotificationModule,
    AdminModule,
    HealthModule,
    SettingsModule,
  ],
})
export class AppModule {}
