# Milestone 2: Photo Pipeline + OBS + Moderation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add content moderation (AWS Rekognition), photo re-upload flow, ETA calculation, premium badge overlay (Sharp composite for screenshots + OBS layer for stream), and a standalone OBS automation service on EC2.

**Architecture:** The backend gains a new `ModerationService` that calls AWS Rekognition after photo upload and before queue entry. Rejected photos trigger an email and expose a re-upload endpoint keyed by supporter ID. The stream service adds ETA calculation based on queue position and average display duration. A standalone Node.js service (`obs-service/`) runs on EC2 alongside OBS, polls the backend API for queue items, and controls OBS via WebSocket. Premium badge overlays are handled as an OBS scene layer for the live stream, and composited server-side using Sharp for keepsake screenshot emails.

**Tech Stack:** NestJS 10, TypeORM, AWS Rekognition (`@aws-sdk/client-rekognition`), Sharp, obs-websocket-js, Node.js

---

## File Map

### Backend modifications (`backend/src/`)

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `domain/moderation/moderation.service.ts` | AWS Rekognition calls, moderation decision logic |
| Create | `domain/moderation/moderation.module.ts` | Module wiring |
| Modify | `domain/photo/photo.controller.ts` | Add `POST /photos/reupload/:supporterId` endpoint |
| Modify | `domain/photo/photo.service.ts` | Add `reuploadPhoto()` method, add `moderateAndSave()` |
| Modify | `domain/photo/photo.module.ts` | Import ModerationModule |
| Modify | `domain/payment/stripe-webhook.service.ts` | Call moderation after payment, handle reject flow |
| Modify | `domain/stream/stream.service.ts` | Add `calculateEta()`, add ETA to `formatQueueItem()` |
| Modify | `domain/stream/stream.controller.ts` | Add `GET /stream/queue/eta/:supporterId` |
| Create | `domain/badge/badge.service.ts` | Sharp composite for badge overlay on screenshots |
| Create | `domain/badge/badge.module.ts` | Module wiring |
| Create | `domain/badge/assets/premium-badge.png` | Badge image asset (generated) |
| Modify | `domain/stream/stream.service.ts` | Use BadgeService in `saveScreenshot()` for premium |
| Modify | `domain/stream/stream.module.ts` | Import BadgeModule |
| Modify | `domain/settings/settings.service.ts` | Add `getRekognitionMinConfidence()` getter |
| Modify | `database/seed.ts` | Seed new settings: moderation thresholds, re-upload limits |
| Modify | `app.module.ts` | Import ModerationModule, BadgeModule |

### OBS Automation Service (new top-level directory)

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `obs-service/package.json` | Dependencies: obs-websocket-js, node-fetch |
| Create | `obs-service/tsconfig.json` | TypeScript config |
| Create | `obs-service/.env.example` | Config template |
| Create | `obs-service/src/index.ts` | Entry point, main loop |
| Create | `obs-service/src/api-client.ts` | Polls backend API for queue items |
| Create | `obs-service/src/obs-controller.ts` | OBS WebSocket connection, scene/source control |
| Create | `obs-service/src/config.ts` | Environment config loader |
| Create | `obs-service/Dockerfile` | Container for EC2 deployment |

---

## Task 1: Install New Dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install AWS Rekognition SDK and Sharp**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
npm install @aws-sdk/client-rekognition sharp
npm install -D @types/sharp
```

- [ ] **Step 2: Verify installation**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
node -e "require('@aws-sdk/client-rekognition'); require('sharp'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
git add package.json package-lock.json
git commit -m "chore: install @aws-sdk/client-rekognition and sharp for milestone 2"
```

---

## Task 2: Moderation Service (AWS Rekognition)

**Files:**
- Create: `backend/src/domain/moderation/moderation.service.ts`
- Create: `backend/src/domain/moderation/moderation.module.ts`
- Modify: `backend/src/domain/settings/settings.service.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Add Rekognition confidence getter to SettingsService**

In `backend/src/domain/settings/settings.service.ts`, add this method after `getModerationApiKey()`:

```typescript
async getRekognitionMinConfidence(): Promise<number> {
  const val = await this.get('rekognition_min_confidence', '75');
  return parseInt(val, 10);
}
```

- [ ] **Step 2: Create moderation service**

Create `backend/src/domain/moderation/moderation.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RekognitionClient,
  DetectModerationLabelsCommand,
} from '@aws-sdk/client-rekognition';
import { SettingsService } from '../settings/settings.service';

export interface ModerationResult {
  approved: boolean;
  reason: string | null;
  labels: Array<{ name: string; confidence: number }>;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private rekognition: RekognitionClient;

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {
    this.rekognition = new RekognitionClient({
      region: this.configService.get('AWS_S3_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  async moderateImage(imageBuffer: Buffer): Promise<ModerationResult> {
    const enabled = await this.settingsService.get('moderation_enabled', 'false');
    if (enabled !== 'true') {
      return { approved: true, reason: null, labels: [] };
    }

    const minConfidence = await this.settingsService.getRekognitionMinConfidence();

    try {
      const command = new DetectModerationLabelsCommand({
        Image: { Bytes: imageBuffer },
        MinConfidence: minConfidence,
      });

      const response = await this.rekognition.send(command);
      const labels = (response.ModerationLabels || []).map((l) => ({
        name: l.Name || 'Unknown',
        confidence: l.Confidence || 0,
      }));

      if (labels.length > 0) {
        const topLabel = labels[0];
        return {
          approved: false,
          reason: `Content flagged: ${topLabel.name} (${topLabel.confidence.toFixed(1)}% confidence)`,
          labels,
        };
      }

      return { approved: true, reason: null, labels: [] };
    } catch (error) {
      this.logger.error('Rekognition moderation failed', error);
      // Fail open: if Rekognition is down, approve the image
      return { approved: true, reason: null, labels: [] };
    }
  }
}
```

- [ ] **Step 3: Create moderation module**

Create `backend/src/domain/moderation/moderation.module.ts`:

```typescript
import { Module, Global } from '@nestjs/common';
import { ModerationService } from './moderation.service';

@Global()
@Module({
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
```

- [ ] **Step 4: Register ModerationModule in AppModule**

In `backend/src/app.module.ts`, add import:

```typescript
import { ModerationModule } from './domain/moderation/moderation.module';
```

Add `ModerationModule` to the `imports` array (after `S3Module`).

- [ ] **Step 5: Verify the app compiles**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
npx nest build
```

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/moderation/ src/domain/settings/settings.service.ts src/app.module.ts
git commit -m "feat: add ModerationService with AWS Rekognition integration"
```

---

## Task 3: Integrate Moderation into Photo Upload + Payment Flow

**Files:**
- Modify: `backend/src/domain/photo/photo.service.ts`
- Modify: `backend/src/domain/photo/photo.module.ts`
- Modify: `backend/src/domain/payment/stripe-webhook.service.ts`

- [ ] **Step 1: Add moderateAndSave method to PhotoService**

In `backend/src/domain/photo/photo.service.ts`, add import at top:

```typescript
import { ModerationService, ModerationResult } from '../moderation/moderation.service';
```

Add `ModerationService` to the constructor:

```typescript
constructor(
  @InjectRepository(PhotoPackage) private packageRepo: Repository<PhotoPackage>,
  private s3: S3Service,
  private moderationService: ModerationService,
) {}
```

Add this method after `saveUploadedFile`:

```typescript
async moderateAndSave(file: Express.Multer.File): Promise<{
  path: string;
  url: string;
  moderation: ModerationResult;
}> {
  // Run moderation on the raw buffer before uploading
  const moderation = await this.moderationService.moderateImage(file.buffer);

  // Upload to S3 regardless (we keep the file for re-review/appeal)
  const { key, url } = await this.s3.upload(
    file.buffer,
    file.originalname,
    'photos',
    file.mimetype,
  );

  return { path: key, url, moderation };
}
```

- [ ] **Step 2: Update PhotoModule to import ModerationModule (already global, but ensure no issues)**

No changes needed since ModerationModule is `@Global()`. But verify `photo.module.ts` still compiles.

- [ ] **Step 3: Update photo upload controller to return moderation result**

In `backend/src/domain/photo/photo.controller.ts`, replace the `uploadPhoto` method body:

```typescript
async uploadPhoto(@UploadedFile() file: Express.Multer.File) {
  if (!file) return { error: 'No valid file uploaded' };
  const result = await this.photoService.moderateAndSave(file);
  return {
    path: result.path,
    url: result.url,
    moderation_status: result.moderation.approved ? 'approved' : 'rejected',
    moderation_reason: result.moderation.reason,
  };
}
```

- [ ] **Step 4: Update stripe-webhook.service.ts to moderate after payment**

In `backend/src/domain/payment/stripe-webhook.service.ts`, the `handlePhotoPayment` method currently creates a queue entry immediately. We need to check `moderation_status` before queuing.

Find the section after `supporter.payment_status = 'completed'` and before `// Get next queue position`. Add moderation check. Replace the queue-creation block with:

```typescript
// Only add to queue if moderation approved
if (supporter.moderation_status === 'approved') {
  // Get next queue position
  const maxPos = await this.queueRepo
    .createQueryBuilder('q')
    .select('MAX(q.queue_position)', 'max')
    .getRawOne();
  const nextPos = (maxPos?.max || 0) + 1;

  const queueItem = this.queueRepo.create({
    supporter_id: supporter.id,
    photo_url: supporter.photo_url || '',
    photo_storage_path: supporter.photo_storage_path,
    package_type: supporter.package_type || 'standard',
    display_duration_seconds: supporter.display_duration_seconds || 10,
    has_badge: supporter.package_type === 'premium',
    queue_position: nextPos,
    status: 'waiting',
  });
  await this.queueRepo.save(queueItem);
  supporter.display_status = 'queued';
} else if (supporter.moderation_status === 'rejected') {
  // Send rejection email with re-upload instructions
  try {
    await this.notificationService.sendTemplateEmail(
      'photo_rejected',
      supporter.email,
      supporter.name,
      {
        name: supporter.name,
        reason: supporter.moderation_reason || 'Content policy violation',
        reupload_url: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reupload/${supporter.id}`,
      },
    );
  } catch (e) {
    this.logger.warn('Rejection email failed', e);
  }
} else {
  // moderation_status is 'pending' — moderation might be disabled, queue anyway
  const maxPos = await this.queueRepo
    .createQueryBuilder('q')
    .select('MAX(q.queue_position)', 'max')
    .getRawOne();
  const nextPos = (maxPos?.max || 0) + 1;

  const queueItem = this.queueRepo.create({
    supporter_id: supporter.id,
    photo_url: supporter.photo_url || '',
    photo_storage_path: supporter.photo_storage_path,
    package_type: supporter.package_type || 'standard',
    display_duration_seconds: supporter.display_duration_seconds || 10,
    has_badge: supporter.package_type === 'premium',
    queue_position: nextPos,
    status: 'waiting',
  });
  await this.queueRepo.save(queueItem);
  supporter.display_status = 'queued';
}
await this.supporterRepo.save(supporter);
```

**Important:** The frontend photo upload endpoint already returns `moderation_status`. The `CreatePhotoCheckoutDto` flow is: upload → get moderation result → if approved, proceed to checkout → webhook creates queue entry. The `payment.service.ts` `createPhotoCheckout` should store the moderation status on the supporter record at creation time.

- [ ] **Step 5: Update PaymentService.createPhotoCheckout to set moderation_status**

In `backend/src/domain/payment/payment.service.ts`, find where the Supporter is created. The `body` (CreatePhotoCheckoutDto) contains `photo_storage_path`. We need to also accept `moderation_status` from the frontend. 

Add `moderation_status` to the DTO. In `backend/src/domain/payment/dto/create-photo-checkout.dto.ts`:

```typescript
import { IsString, IsEmail, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePhotoCheckoutDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ enum: ['standard', 'premium'] })
  @IsEnum(['standard', 'premium'])
  package_type: 'standard' | 'premium';

  @ApiProperty()
  @IsString()
  photo_storage_path: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  origin?: string;

  @ApiProperty({ required: false, enum: ['approved', 'rejected', 'pending'] })
  @IsEnum(['approved', 'rejected', 'pending'])
  @IsOptional()
  moderation_status?: 'approved' | 'rejected' | 'pending';

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  moderation_reason?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  photo_url?: string;
}
```

Then in `payment.service.ts`, when creating the supporter, set the moderation fields:

```typescript
moderation_status: body.moderation_status || 'pending',
moderation_reason: body.moderation_reason || null,
photo_url: body.photo_url || '',
```

- [ ] **Step 6: Verify build**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
npx nest build
```

- [ ] **Step 7: Commit**

```bash
git add src/domain/photo/ src/domain/payment/ 
git commit -m "feat: integrate AWS Rekognition moderation into photo upload and payment flow"
```

---

## Task 4: Photo Re-upload Endpoint

**Files:**
- Modify: `backend/src/domain/photo/photo.controller.ts`
- Modify: `backend/src/domain/photo/photo.service.ts`
- Modify: `backend/src/domain/photo/photo.module.ts`

- [ ] **Step 1: Add Supporter entity to PhotoModule**

In `backend/src/domain/photo/photo.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotoPackage } from './photo-package.entity';
import { Supporter } from '../fundraising/supporter.entity';
import { PhotoService } from './photo.service';
import { PhotoController } from './photo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PhotoPackage, Supporter])],
  controllers: [PhotoController],
  providers: [PhotoService],
  exports: [PhotoService],
})
export class PhotoModule {}
```

- [ ] **Step 2: Add reuploadPhoto method to PhotoService**

In `backend/src/domain/photo/photo.service.ts`, add import:

```typescript
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhotoPackage } from './photo-package.entity';
import { Supporter } from '../fundraising/supporter.entity';
import { S3Service } from '../../common/services/s3.service';
import { ModerationService, ModerationResult } from '../moderation/moderation.service';
```

Update constructor to inject Supporter repo:

```typescript
constructor(
  @InjectRepository(PhotoPackage) private packageRepo: Repository<PhotoPackage>,
  @InjectRepository(Supporter) private supporterRepo: Repository<Supporter>,
  private s3: S3Service,
  private moderationService: ModerationService,
) {}
```

Add the reupload method:

```typescript
async reuploadPhoto(
  supporterId: string,
  file: Express.Multer.File,
): Promise<{
  success: boolean;
  moderation_status: string;
  moderation_reason: string | null;
}> {
  const supporter = await this.supporterRepo.findOne({
    where: { id: supporterId },
  });

  if (!supporter) {
    return { success: false, moderation_status: 'error', moderation_reason: 'Supporter not found' };
  }

  if (supporter.payment_status !== 'completed') {
    return { success: false, moderation_status: 'error', moderation_reason: 'Payment not completed' };
  }

  if (supporter.display_status === 'displayed') {
    return { success: false, moderation_status: 'error', moderation_reason: 'Photo already displayed' };
  }

  // Moderate the new image
  const moderation = await this.moderationService.moderateImage(file.buffer);

  // Upload to S3
  const { key, url } = await this.s3.upload(
    file.buffer,
    file.originalname,
    'photos',
    file.mimetype,
  );

  // Update supporter record
  supporter.photo_url = url;
  supporter.photo_storage_path = key;
  supporter.moderation_status = moderation.approved ? 'approved' : 'rejected';
  supporter.moderation_reason = moderation.reason;
  await this.supporterRepo.save(supporter);

  // If now approved and not yet queued, add to queue
  if (moderation.approved && supporter.display_status !== 'queued') {
    // We need access to StreamQueue repo — emit event instead
    // The webhook service or a listener will handle queue insertion
  }

  return {
    success: true,
    moderation_status: moderation.approved ? 'approved' : 'rejected',
    moderation_reason: moderation.reason,
  };
}
```

- [ ] **Step 3: Add re-upload controller endpoint**

In `backend/src/domain/photo/photo.controller.ts`, add this endpoint after `uploadPhoto`:

```typescript
@Post('reupload/:supporterId')
@ApiOperation({ summary: 'Re-upload a photo after moderation rejection (public)' })
@ApiParam({ name: 'supporterId', description: 'Supporter ID from rejection email' })
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' },
    },
    required: ['file'],
  },
})
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
}))
async reuploadPhoto(
  @Param('supporterId') supporterId: string,
  @UploadedFile() file: Express.Multer.File,
) {
  if (!file) return { error: 'No valid file uploaded' };
  return this.photoService.reuploadPhoto(supporterId, file);
}
```

Add `Param` to the imports from `@nestjs/common` if not already there.

- [ ] **Step 4: Handle queue insertion for re-uploaded approved photos**

We need to add queue insertion logic to the `reuploadPhoto` method in `photo.service.ts`. Since PhotoService doesn't have access to StreamQueue, we'll use the EventEmitter pattern already established in the codebase.

Add EventEmitter2 to PhotoService:

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
```

Add to constructor:

```typescript
constructor(
  @InjectRepository(PhotoPackage) private packageRepo: Repository<PhotoPackage>,
  @InjectRepository(Supporter) private supporterRepo: Repository<Supporter>,
  private s3: S3Service,
  private moderationService: ModerationService,
  private eventEmitter: EventEmitter2,
) {}
```

Replace the comment block in `reuploadPhoto` (`// If now approved...`) with:

```typescript
if (moderation.approved && !supporter.display_status) {
  supporter.display_status = 'queued';
  await this.supporterRepo.save(supporter);
  this.eventEmitter.emit('photo.approved_after_reupload', {
    supporterId: supporter.id,
    photoUrl: url,
    photoStoragePath: key,
    packageType: supporter.package_type,
    displayDurationSeconds: supporter.display_duration_seconds,
  });
}
```

- [ ] **Step 5: Listen for reupload approval in StreamService**

In `backend/src/domain/stream/stream.service.ts`, add the `OnEvent` decorator import:

```typescript
import { OnEvent } from '@nestjs/event-emitter';
```

Add this listener method to the StreamService class:

```typescript
@OnEvent('photo.approved_after_reupload')
async handleReuploadApproved(payload: {
  supporterId: string;
  photoUrl: string;
  photoStoragePath: string;
  packageType: string;
  displayDurationSeconds: number;
}) {
  const maxPos = await this.queueRepo
    .createQueryBuilder('q')
    .select('MAX(q.queue_position)', 'max')
    .getRawOne();
  const nextPos = (maxPos?.max || 0) + 1;

  const queueItem = this.queueRepo.create({
    supporter_id: payload.supporterId,
    photo_url: payload.photoUrl,
    photo_storage_path: payload.photoStoragePath,
    package_type: payload.packageType as 'standard' | 'premium',
    display_duration_seconds: payload.displayDurationSeconds || 10,
    has_badge: payload.packageType === 'premium',
    queue_position: nextPos,
    status: 'waiting',
  });
  await this.queueRepo.save(queueItem);
  this.eventEmitter.emit('queue.updated');
}
```

- [ ] **Step 6: Verify build**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
npx nest build
```

- [ ] **Step 7: Commit**

```bash
git add src/domain/photo/ src/domain/stream/stream.service.ts
git commit -m "feat: add photo re-upload endpoint for moderation-rejected photos"
```

---

## Task 5: ETA Calculation

**Files:**
- Modify: `backend/src/domain/stream/stream.service.ts`
- Modify: `backend/src/domain/stream/stream.controller.ts`

- [ ] **Step 1: Add calculateEta method to StreamService**

In `backend/src/domain/stream/stream.service.ts`, add this method:

```typescript
async calculateEta(supporterId: string): Promise<{
  queue_position: number | null;
  items_ahead: number;
  estimated_seconds: number;
  estimated_display_at: Date | null;
}> {
  // Find the supporter's queue item
  const item = await this.queueRepo.findOne({
    where: { supporter_id: supporterId, status: 'waiting' },
  });

  if (!item) {
    return { queue_position: null, items_ahead: 0, estimated_seconds: 0, estimated_display_at: null };
  }

  // Count items ahead (lower queue position or premium priority)
  const itemsAhead = await this.queueRepo
    .createQueryBuilder('q')
    .where('q.status = :status', { status: 'waiting' })
    .andWhere(
      '(CASE WHEN q.package_type = \'premium\' THEN 0 ELSE 1 END < CASE WHEN :pkgType = \'premium\' THEN 0 ELSE 1 END) OR ' +
      '(CASE WHEN q.package_type = \'premium\' THEN 0 ELSE 1 END = CASE WHEN :pkgType = \'premium\' THEN 0 ELSE 1 END AND q.queue_position < :pos)',
      { pkgType: item.package_type, pos: item.queue_position },
    )
    .getCount();

  // Calculate average display duration from recent displayed items
  const avgResult = await this.queueRepo
    .createQueryBuilder('q')
    .select('AVG(q.display_duration_seconds)', 'avg')
    .where('q.status = :status', { status: 'displayed' })
    .andWhere('q.display_ended_at IS NOT NULL')
    .getRawOne();

  const avgDuration = parseFloat(avgResult?.avg) || 15; // default 15s if no history
  const estimatedSeconds = Math.ceil(itemsAhead * avgDuration);
  const estimatedDisplayAt = new Date(Date.now() + estimatedSeconds * 1000);

  // Update the queue item's estimated_display_at
  item.estimated_display_at = estimatedDisplayAt;
  await this.queueRepo.save(item);

  return {
    queue_position: item.queue_position,
    items_ahead: itemsAhead,
    estimated_seconds: estimatedSeconds,
    estimated_display_at: estimatedDisplayAt,
  };
}
```

- [ ] **Step 2: Add ETA to formatQueueItem**

In `backend/src/domain/stream/stream.service.ts`, update `formatQueueItem`:

```typescript
private formatQueueItem(item: StreamQueue) {
  return {
    id: item.id,
    photo_url: item.photo_url,
    package_type: item.package_type,
    display_duration_seconds: item.display_duration_seconds,
    has_badge: item.has_badge,
    queue_position: item.queue_position,
    status: item.status,
    supporter_name: item.supporter?.name || 'Anonymous',
    supporter_email: item.supporter?.email,
    estimated_display_at: item.estimated_display_at,
    display_started_at: item.display_started_at,
    display_ended_at: item.display_ended_at,
    created_at: item.created_at,
  };
}
```

- [ ] **Step 3: Add ETA endpoint to StreamController**

In `backend/src/domain/stream/stream.controller.ts`, add:

```typescript
@Get('queue/eta/:supporterId')
@ApiOperation({ summary: 'Get estimated display time for a supporter' })
@ApiParam({ name: 'supporterId', description: 'Supporter UUID' })
getEta(@Param('supporterId') supporterId: string) {
  return this.streamService.calculateEta(supporterId);
}
```

Make sure `Param` is imported from `@nestjs/common`.

- [ ] **Step 4: Verify build**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
npx nest build
```

- [ ] **Step 5: Commit**

```bash
git add src/domain/stream/
git commit -m "feat: add ETA calculation for queue position with supporter endpoint"
```

---

## Task 6: Premium Badge Overlay Service (Sharp Composite)

**Files:**
- Create: `backend/src/domain/badge/badge.service.ts`
- Create: `backend/src/domain/badge/badge.module.ts`
- Create: `backend/src/domain/badge/assets/` (directory for badge PNG)
- Modify: `backend/src/domain/stream/stream.service.ts`
- Modify: `backend/src/domain/stream/stream.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create premium badge PNG asset**

Create the badge directory and generate a simple badge image programmatically (we'll use Sharp to create one):

Create `backend/src/domain/badge/generate-badge.ts` (one-time script):

```typescript
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';

async function generateBadge() {
  const assetsDir = path.join(__dirname, 'assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  // Create a 120x120 premium badge with gold star
  const svgBadge = `
    <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#FFA500;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#00000066"/>
        </filter>
      </defs>
      <circle cx="60" cy="60" r="55" fill="url(#gold)" stroke="#B8860B" stroke-width="3" filter="url(#shadow)"/>
      <text x="60" y="45" text-anchor="middle" fill="#FFFFFF" font-size="14" font-weight="bold" font-family="Arial">★</text>
      <text x="60" y="65" text-anchor="middle" fill="#FFFFFF" font-size="14" font-weight="bold" font-family="Arial">PREMIUM</text>
      <text x="60" y="82" text-anchor="middle" fill="#FFFFFF" font-size="10" font-family="Arial">SUPPORTER</text>
    </svg>`;

  await sharp(Buffer.from(svgBadge))
    .resize(120, 120)
    .png()
    .toFile(path.join(assetsDir, 'premium-badge.png'));

  console.log('Badge generated at assets/premium-badge.png');
}

generateBadge();
```

Run it once:

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
npx ts-node src/domain/badge/generate-badge.ts
```

Then delete `generate-badge.ts` — the PNG is the deliverable.

- [ ] **Step 2: Create BadgeService**

Create `backend/src/domain/badge/badge.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class BadgeService {
  private readonly logger = new Logger(BadgeService.name);
  private badgePath: string;

  constructor() {
    this.badgePath = path.join(__dirname, 'assets', 'premium-badge.png');
    if (!fs.existsSync(this.badgePath)) {
      this.logger.warn(`Premium badge not found at ${this.badgePath}`);
    }
  }

  async compositeScreenshotWithBadge(screenshotBuffer: Buffer): Promise<Buffer> {
    if (!fs.existsSync(this.badgePath)) {
      this.logger.warn('Badge file missing, returning original screenshot');
      return screenshotBuffer;
    }

    const metadata = await sharp(screenshotBuffer).metadata();
    const width = metadata.width || 1920;

    // Scale badge relative to image width (badge = ~6% of width)
    const badgeSize = Math.round(width * 0.06);
    const margin = Math.round(width * 0.02);

    const resizedBadge = await sharp(this.badgePath)
      .resize(badgeSize, badgeSize)
      .toBuffer();

    return sharp(screenshotBuffer)
      .composite([
        {
          input: resizedBadge,
          top: margin,
          left: width - badgeSize - margin,
        },
      ])
      .png()
      .toBuffer();
  }
}
```

- [ ] **Step 3: Create BadgeModule**

Create `backend/src/domain/badge/badge.module.ts`:

```typescript
import { Module, Global } from '@nestjs/common';
import { BadgeService } from './badge.service';

@Global()
@Module({
  providers: [BadgeService],
  exports: [BadgeService],
})
export class BadgeModule {}
```

- [ ] **Step 4: Register BadgeModule in AppModule**

In `backend/src/app.module.ts`, add import:

```typescript
import { BadgeModule } from './domain/badge/badge.module';
```

Add `BadgeModule` to imports array.

- [ ] **Step 5: Integrate badge composite into screenshot flow**

In `backend/src/domain/stream/stream.service.ts`, add import:

```typescript
import { BadgeService } from '../badge/badge.service';
```

Add to constructor:

```typescript
constructor(
  @InjectRepository(StreamQueue) private queueRepo: Repository<StreamQueue>,
  @InjectRepository(StreamEvent) private eventRepo: Repository<StreamEvent>,
  @InjectRepository(Supporter) private supporterRepo: Repository<Supporter>,
  private settingsService: SettingsService,
  private photoService: PhotoService,
  private badgeService: BadgeService,
  private dataSource: DataSource,
  private eventEmitter: EventEmitter2,
) {}
```

Update the `saveScreenshot` method to composite badge for premium:

```typescript
async saveScreenshot(queueId: string, base64: string) {
  const item = await this.queueRepo.findOne({
    where: { id: queueId },
    relations: ['supporter'],
  });

  let buffer = Buffer.from(
    base64.replace(/^data:image\/\w+;base64,/, ''),
    'base64',
  );

  // Composite badge onto screenshot for premium supporters
  if (item?.has_badge) {
    buffer = await this.badgeService.compositeScreenshotWithBadge(buffer);
  }

  const { url } = await this.photoService.s3.upload(
    buffer,
    `${queueId}.png`,
    'screenshots',
    'image/png',
  );

  await this.queueRepo.update(queueId, { screenshot_url: url });

  if (item?.supporter) {
    item.supporter.display_screenshot_url = url;
    await this.supporterRepo.save(item.supporter);
  }

  return { screenshot_url: url };
}
```

**Note:** This requires making the `s3` property on `PhotoService` public (or adding a getter). In `photo.service.ts`, change:

```typescript
// Change from:
private s3: S3Service,
// To:
public readonly s3: S3Service,
```

Alternatively, add a `getS3()` method or move the upload to a shared method. The simplest change is making `s3` public since S3Service is already global.

- [ ] **Step 6: Verify build**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
npx nest build
```

- [ ] **Step 7: Commit**

```bash
git add src/domain/badge/ src/domain/stream/ src/domain/photo/photo.service.ts src/app.module.ts
git commit -m "feat: add premium badge overlay service with Sharp composite for screenshots"
```

---

## Task 7: Seed New Admin-Configurable Settings

**Files:**
- Modify: `backend/src/database/seed.ts`

- [ ] **Step 1: Add moderation and badge settings to seed**

In `backend/src/database/seed.ts`, add these to the settings array that gets seeded:

```typescript
// Moderation settings
{ key: 'moderation_enabled', value: 'true', category: 'moderation', description: 'Enable AWS Rekognition content moderation' },
{ key: 'rekognition_min_confidence', value: '75', category: 'moderation', description: 'Minimum confidence threshold for Rekognition moderation (0-100)' },
{ key: 'moderation_fail_open', value: 'true', category: 'moderation', description: 'If true, approve photos when moderation service is unavailable' },
{ key: 'max_reupload_attempts', value: '3', category: 'moderation', description: 'Maximum number of re-upload attempts per supporter' },
{ key: 'rejection_message', value: 'Your photo was flagged by our content filter. Please upload a different photo.', category: 'moderation', description: 'Default rejection message sent to users' },

// Badge settings
{ key: 'premium_badge_enabled', value: 'true', category: 'stream', description: 'Show premium badge overlay on stream and screenshots' },

// OBS settings
{ key: 'obs_poll_interval_ms', value: '3000', category: 'stream', description: 'How often OBS service polls for next queue item (ms)' },
{ key: 'obs_transition_type', value: 'fade', category: 'stream', description: 'OBS scene transition type (fade, cut, slide)' },
{ key: 'obs_transition_duration_ms', value: '500', category: 'stream', description: 'OBS transition duration in milliseconds' },
```

- [ ] **Step 2: Verify build**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
npx nest build
```

- [ ] **Step 3: Commit**

```bash
git add src/database/seed.ts
git commit -m "feat: seed admin-configurable settings for moderation, badge, and OBS"
```

---

## Task 8: OBS Automation Service — Project Setup

**Files:**
- Create: `obs-service/package.json`
- Create: `obs-service/tsconfig.json`
- Create: `obs-service/.env.example`
- Create: `obs-service/src/config.ts`

- [ ] **Step 1: Create obs-service directory and package.json**

```bash
mkdir -p /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/obs-service/src
```

Create `obs-service/package.json`:

```json
{
  "name": "obs-automation-service",
  "version": "1.0.0",
  "description": "Standalone OBS automation service that polls the fundraising backend and controls OBS via WebSocket",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts"
  },
  "dependencies": {
    "obs-websocket-js": "^5.0.6"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2",
    "@types/node": "^20.11.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `obs-service/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create .env.example**

Create `obs-service/.env.example`:

```env
# Backend API
BACKEND_API_URL=http://localhost:3001/api
API_POLL_INTERVAL_MS=3000

# OBS WebSocket
OBS_WS_URL=ws://localhost:4455
OBS_WS_PASSWORD=your-obs-websocket-password

# OBS Scene Config
OBS_SCENE_NAME=PhotoDisplay
OBS_IMAGE_SOURCE_NAME=SupporterPhoto
OBS_BADGE_SOURCE_NAME=PremiumBadge
OBS_TRANSITION_TYPE=fade
OBS_TRANSITION_DURATION_MS=500

# Screenshot
SCREENSHOT_ENABLED=true
```

- [ ] **Step 4: Create config loader**

Create `obs-service/src/config.ts`:

```typescript
export interface Config {
  backendApiUrl: string;
  apiPollIntervalMs: number;
  obsWsUrl: string;
  obsWsPassword: string;
  obsSceneName: string;
  obsImageSourceName: string;
  obsBadgeSourceName: string;
  obsTransitionType: string;
  obsTransitionDurationMs: number;
  screenshotEnabled: boolean;
}

export function loadConfig(): Config {
  return {
    backendApiUrl: process.env.BACKEND_API_URL || 'http://localhost:3001/api',
    apiPollIntervalMs: parseInt(process.env.API_POLL_INTERVAL_MS || '3000', 10),
    obsWsUrl: process.env.OBS_WS_URL || 'ws://localhost:4455',
    obsWsPassword: process.env.OBS_WS_PASSWORD || '',
    obsSceneName: process.env.OBS_SCENE_NAME || 'PhotoDisplay',
    obsImageSourceName: process.env.OBS_IMAGE_SOURCE_NAME || 'SupporterPhoto',
    obsBadgeSourceName: process.env.OBS_BADGE_SOURCE_NAME || 'PremiumBadge',
    obsTransitionType: process.env.OBS_TRANSITION_TYPE || 'fade',
    obsTransitionDurationMs: parseInt(process.env.OBS_TRANSITION_DURATION_MS || '500', 10),
    screenshotEnabled: process.env.SCREENSHOT_ENABLED !== 'false',
  };
}
```

- [ ] **Step 5: Install dependencies**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/obs-service
npm install
```

- [ ] **Step 6: Commit**

```bash
git add obs-service/
git commit -m "feat: scaffold OBS automation service with config and dependencies"
```

---

## Task 9: OBS Automation Service — API Client

**Files:**
- Create: `obs-service/src/api-client.ts`

- [ ] **Step 1: Create API client**

Create `obs-service/src/api-client.ts`:

```typescript
import { Config } from './config';

export interface QueueItem {
  id: string;
  photo_url: string;
  package_type: 'standard' | 'premium';
  display_duration_seconds: number;
  has_badge: boolean;
  queue_position: number;
  status: string;
  supporter_name: string;
}

export interface QueueResponse {
  status: 'new' | 'displaying' | 'idle' | 'paused';
  item?: QueueItem;
}

export class ApiClient {
  private baseUrl: string;

  constructor(config: Config) {
    this.baseUrl = config.backendApiUrl;
  }

  async getNextQueueItem(): Promise<QueueResponse> {
    const res = await fetch(`${this.baseUrl}/stream/queue/next`);
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async advanceQueue(queueId: string, screenshotUrl?: string): Promise<void> {
    const body: Record<string, string> = {};
    if (screenshotUrl) body.screenshot_url = screenshotUrl;

    const res = await fetch(`${this.baseUrl}/stream/queue/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_id: queueId, screenshot_url: screenshotUrl }),
    });
    if (!res.ok) throw new Error(`Advance failed: ${res.status}`);
  }

  async uploadScreenshot(queueId: string, base64Data: string): Promise<{ screenshot_url: string }> {
    const res = await fetch(`${this.baseUrl}/stream/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_id: queueId, screenshot: base64Data }),
    });
    if (!res.ok) throw new Error(`Screenshot upload failed: ${res.status}`);
    return res.json();
  }

  async trackView(queueId: string, screenTimeSeconds: number): Promise<void> {
    await fetch(`${this.baseUrl}/stream/queue/track-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: queueId, screen_time_seconds: screenTimeSeconds }),
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add obs-service/src/api-client.ts
git commit -m "feat: add OBS service API client for backend queue interaction"
```

---

## Task 10: OBS Automation Service — OBS Controller

**Files:**
- Create: `obs-service/src/obs-controller.ts`

- [ ] **Step 1: Create OBS WebSocket controller**

Create `obs-service/src/obs-controller.ts`:

```typescript
import OBSWebSocket from 'obs-websocket-js';
import { Config } from './config';

export class ObsController {
  private obs: OBSWebSocket;
  private config: Config;
  private connected = false;

  constructor(config: Config) {
    this.obs = new OBSWebSocket();
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      await this.obs.connect(this.config.obsWsUrl, this.config.obsWsPassword || undefined);
      this.connected = true;
      console.log('[OBS] Connected to OBS WebSocket');

      this.obs.on('ConnectionClosed', () => {
        this.connected = false;
        console.log('[OBS] Connection closed, will retry...');
      });
    } catch (err) {
      console.error('[OBS] Connection failed:', err);
      this.connected = false;
      throw err;
    }
  }

  async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  async setPhotoSource(imageUrl: string): Promise<void> {
    await this.ensureConnected();
    await this.obs.call('SetInputSettings', {
      inputName: this.config.obsImageSourceName,
      inputSettings: { url: imageUrl },
    });
    console.log(`[OBS] Set photo source to: ${imageUrl}`);
  }

  async setBadgeVisible(visible: boolean): Promise<void> {
    await this.ensureConnected();
    try {
      const { sceneItemId } = await this.obs.call('GetSceneItemId', {
        sceneName: this.config.obsSceneName,
        sourceName: this.config.obsBadgeSourceName,
      });
      await this.obs.call('SetSceneItemEnabled', {
        sceneName: this.config.obsSceneName,
        sceneItemId,
        sceneItemEnabled: visible,
      });
      console.log(`[OBS] Badge visibility: ${visible}`);
    } catch (err) {
      console.warn('[OBS] Could not toggle badge:', err);
    }
  }

  async triggerTransition(): Promise<void> {
    await this.ensureConnected();
    try {
      await this.obs.call('SetCurrentSceneTransition', {
        transitionName: this.config.obsTransitionType === 'cut' ? 'Cut' : 'Fade',
      });
      await this.obs.call('SetCurrentSceneTransitionDuration', {
        transitionDuration: this.config.obsTransitionDurationMs,
      });
    } catch (err) {
      console.warn('[OBS] Transition setting failed:', err);
    }
  }

  async takeScreenshot(): Promise<string | null> {
    await this.ensureConnected();
    try {
      const response = await this.obs.call('GetSourceScreenshot', {
        sourceName: this.config.obsSceneName,
        imageFormat: 'png',
        imageWidth: 1920,
        imageHeight: 1080,
      });
      return response.imageData; // base64 string
    } catch (err) {
      console.error('[OBS] Screenshot failed:', err);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.obs.disconnect();
      this.connected = false;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add obs-service/src/obs-controller.ts
git commit -m "feat: add OBS WebSocket controller for scene/source management"
```

---

## Task 11: OBS Automation Service — Main Loop

**Files:**
- Create: `obs-service/src/index.ts`

- [ ] **Step 1: Create main entry point with polling loop**

Create `obs-service/src/index.ts`:

```typescript
import { loadConfig } from './config';
import { ApiClient, QueueItem } from './api-client';
import { ObsController } from './obs-controller';

const config = loadConfig();
const api = new ApiClient(config);
const obs = new ObsController(config);

let currentItem: QueueItem | null = null;
let displayStartTime: number | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleNewItem(item: QueueItem): Promise<void> {
  console.log(`[MAIN] Displaying: ${item.supporter_name} (${item.package_type}) for ${item.display_duration_seconds}s`);

  // Set the photo in OBS
  await obs.setPhotoSource(item.photo_url);

  // Toggle premium badge visibility
  await obs.setBadgeVisible(item.has_badge);

  // Trigger transition
  await obs.triggerTransition();

  currentItem = item;
  displayStartTime = Date.now();

  // Wait for display duration
  await sleep(item.display_duration_seconds * 1000);

  // Take screenshot before advancing
  if (config.screenshotEnabled) {
    try {
      const screenshotBase64 = await obs.takeScreenshot();
      if (screenshotBase64) {
        const result = await api.uploadScreenshot(item.id, screenshotBase64);
        console.log(`[MAIN] Screenshot saved: ${result.screenshot_url}`);
        await api.advanceQueue(item.id, result.screenshot_url);
      } else {
        await api.advanceQueue(item.id);
      }
    } catch (err) {
      console.error('[MAIN] Screenshot/advance error:', err);
      await api.advanceQueue(item.id);
    }
  } else {
    await api.advanceQueue(item.id);
  }

  // Track view time
  const screenTime = Math.round((Date.now() - (displayStartTime || Date.now())) / 1000);
  await api.trackView(item.id, screenTime).catch(() => {});

  currentItem = null;
  displayStartTime = null;
  console.log(`[MAIN] Done displaying: ${item.supporter_name}`);
}

async function pollLoop(): Promise<void> {
  console.log('[MAIN] OBS Automation Service starting...');
  console.log(`[MAIN] Backend: ${config.backendApiUrl}`);
  console.log(`[MAIN] Poll interval: ${config.apiPollIntervalMs}ms`);

  // Connect to OBS
  let obsConnected = false;
  while (!obsConnected) {
    try {
      await obs.connect();
      obsConnected = true;
    } catch {
      console.log('[MAIN] Retrying OBS connection in 5s...');
      await sleep(5000);
    }
  }

  // Main polling loop
  while (true) {
    try {
      const response = await api.getNextQueueItem();

      switch (response.status) {
        case 'new':
          if (response.item) {
            await handleNewItem(response.item);
          }
          break;

        case 'displaying':
          // Something is already being displayed (maybe from a restart)
          // Wait and let it finish
          console.log('[MAIN] Item already displaying, waiting...');
          await sleep(config.apiPollIntervalMs);
          break;

        case 'paused':
          console.log('[MAIN] Queue paused, waiting...');
          await sleep(config.apiPollIntervalMs * 2);
          break;

        case 'idle':
          // No items in queue
          await sleep(config.apiPollIntervalMs);
          break;
      }
    } catch (err) {
      console.error('[MAIN] Poll error:', err);
      await sleep(config.apiPollIntervalMs);
    }
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[MAIN] Shutting down...');
  await obs.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[MAIN] Shutting down...');
  await obs.disconnect();
  process.exit(0);
});

pollLoop().catch((err) => {
  console.error('[MAIN] Fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/obs-service
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add obs-service/src/index.ts
git commit -m "feat: add OBS service main polling loop with display, screenshot, and advance flow"
```

---

## Task 12: OBS Service — Dockerfile

**Files:**
- Create: `obs-service/Dockerfile`
- Modify: `docker-compose.yml` (add obs-service to compose)

- [ ] **Step 1: Create Dockerfile**

Create `obs-service/Dockerfile`:

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Add obs-service to docker-compose.yml**

In the root `docker-compose.yml`, add the obs-service alongside the existing services:

```yaml
  obs-service:
    build:
      context: ./obs-service
      dockerfile: Dockerfile
    container_name: burger-obs-service
    restart: unless-stopped
    environment:
      - BACKEND_API_URL=http://backend:3001/api
      - OBS_WS_URL=ws://host.docker.internal:4455
      - OBS_WS_PASSWORD=${OBS_WS_PASSWORD:-}
      - API_POLL_INTERVAL_MS=3000
      - SCREENSHOT_ENABLED=true
    depends_on:
      - backend
    networks:
      - default
```

Note: `host.docker.internal` is used because OBS runs on the host EC2 instance, not in Docker. On Linux EC2, you may need `--add-host=host.docker.internal:host-gateway` in the docker run command if using an older Docker version.

- [ ] **Step 3: Commit**

```bash
git add obs-service/Dockerfile docker-compose.yml
git commit -m "feat: add OBS service Dockerfile and docker-compose integration"
```

---

## Task 13: Add Re-upload Attempt Tracking

**Files:**
- Modify: `backend/src/domain/fundraising/supporter.entity.ts`
- Modify: `backend/src/domain/photo/photo.service.ts`

- [ ] **Step 1: Add reupload_count to Supporter entity**

In `backend/src/domain/fundraising/supporter.entity.ts`, add this column alongside the other moderation fields:

```typescript
@Column({ type: 'int', default: 0 })
reupload_count: number;
```

- [ ] **Step 2: Enforce max re-upload attempts in PhotoService.reuploadPhoto**

In `backend/src/domain/photo/photo.service.ts`, update `reuploadPhoto` method. After the `display_status === 'displayed'` check, add:

```typescript
// Check re-upload limit
const maxAttempts = parseInt(
  await this.settingsService.get('max_reupload_attempts', '3'),
  10,
);
if (supporter.reupload_count >= maxAttempts) {
  return {
    success: false,
    moderation_status: 'error',
    moderation_reason: `Maximum re-upload attempts (${maxAttempts}) reached`,
  };
}
```

And after `await this.supporterRepo.save(supporter)`, increment the counter:

```typescript
supporter.reupload_count = (supporter.reupload_count || 0) + 1;
```

(This line should go before the `save` call, alongside the other field updates.)

**Note:** PhotoService needs SettingsService injected. Add to constructor:

```typescript
import { SettingsService } from '../settings/settings.service';
```

```typescript
constructor(
  @InjectRepository(PhotoPackage) private packageRepo: Repository<PhotoPackage>,
  @InjectRepository(Supporter) private supporterRepo: Repository<Supporter>,
  public readonly s3: S3Service,
  private moderationService: ModerationService,
  private settingsService: SettingsService,
  private eventEmitter: EventEmitter2,
) {}
```

- [ ] **Step 3: Verify build**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
npx nest build
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/fundraising/supporter.entity.ts src/domain/photo/photo.service.ts
git commit -m "feat: add re-upload attempt tracking with configurable max limit"
```

---

## Task 14: Update Settings Public Filter

**Files:**
- Modify: `backend/src/domain/settings/settings.service.ts`

- [ ] **Step 1: Ensure new setting categories are not leaked via public endpoint**

In `settings.service.ts`, find the `getPublicSettings()` method and the sensitive keys list. Verify that `rekognition_min_confidence` and other moderation internals are NOT in the sensitive list (they're not secret, just operational). No changes needed if the current filter only blocks API keys.

However, if the admin wants to hide moderation thresholds from the public API, add them:

```typescript
// In the sensitive keys filter array, no changes needed.
// Moderation settings like rekognition_min_confidence are operational, not secret.
// They can stay in the public settings response.
```

This is a no-op verification step. Move on.

- [ ] **Step 2: Commit** (skip if no changes)

---

## Task 15: Final Integration Verification

- [ ] **Step 1: Run full backend build**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
npx nest build
```

Expected: Clean build, no errors.

- [ ] **Step 2: Run seed to verify new settings**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
npm run seed
```

Expected: Seeds complete with new moderation/OBS settings.

- [ ] **Step 3: Start dev server and verify endpoints**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/backend
npm run start:dev
```

Test these endpoints:
- `GET /api/photos/packages` — should return packages
- `GET /api/stream/queue` — should return queue state
- `GET /api/settings` — should include new moderation settings
- Check Swagger at `http://localhost:3001/api/docs` — verify new endpoints appear:
  - `POST /api/photos/reupload/:supporterId`
  - `GET /api/stream/queue/eta/:supporterId`

- [ ] **Step 4: Build OBS service**

```bash
cd /home/jonayed/Desktop/Nexal/fund_raising/fundraising-platform-backend/obs-service
npm run build
```

Expected: TypeScript compiles to `dist/`.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Milestone 2 — photo moderation, re-upload, ETA, badge overlay, OBS service"
```
