import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotoPackage } from './photo-package.entity';
import { PhotoService } from './photo.service';
import { PhotoController } from './photo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PhotoPackage])],
  controllers: [PhotoController],
  providers: [PhotoService],
  exports: [PhotoService],
})
export class PhotoModule {}
