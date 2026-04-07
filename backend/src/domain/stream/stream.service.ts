import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OnEvent } from '@nestjs/event-emitter';
import { StreamQueue } from './stream-queue.entity';
import { StreamEvent } from './stream-event.entity';
import { Supporter } from '../fundraising/supporter.entity';
import { SettingsService } from '../settings/settings.service';
import { PhotoService } from '../photo/photo.service';
import { BadgeService } from '../badge/badge.service';

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);

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

  async getQueue() {
    const current = await this.queueRepo.findOne({
      where: { status: 'displaying' },
      relations: ['supporter'],
    });
    const upcoming = await this.queueRepo.find({
      where: { status: 'waiting' },
      order: { queue_position: 'ASC' },
      take: 10,
      relations: ['supporter'],
    });
    const totalWaiting = await this.queueRepo.count({ where: { status: 'waiting' } });
    return { current, upcoming, total_waiting: totalWaiting };
  }

  async getQueueDisplay() {
    const current = await this.queueRepo.findOne({
      where: { status: 'displaying' },
      relations: ['supporter'],
    });
    const upcoming = await this.queueRepo.find({
      where: { status: 'waiting' },
      order: { queue_position: 'ASC' },
      take: 10,
      relations: ['supporter'],
    });
    const recentlyDisplayed = await this.queueRepo.find({
      where: { status: 'displayed' },
      order: { display_ended_at: 'DESC' },
      take: 5,
      relations: ['supporter'],
    });
    const totalWaiting = await this.queueRepo.count({ where: { status: 'waiting' } });

    return {
      current: current ? this.formatQueueItem(current) : null,
      upcoming: upcoming.map((i) => this.formatQueueItem(i)),
      recently_displayed: recentlyDisplayed.map((i) => this.formatQueueItem(i)),
      total_waiting: totalWaiting,
    };
  }

  private formatQueueItem(item: StreamQueue) {
    return {
      id: item.id,
      photo_url: item.photo_url,
      package_type: item.package_type,
      display_duration_seconds: item.display_duration_seconds,
      has_badge: item.has_badge,
      queue_position: item.queue_position,
      status: item.status,
      estimated_display_at: item.estimated_display_at,
      supporter_name: item.supporter?.name || 'Anonymous',
      supporter_email: item.supporter?.email,
      display_started_at: item.display_started_at,
      display_ended_at: item.display_ended_at,
      created_at: item.created_at,
    };
  }

  async grabNextQueueItem() {
    const paused = await this.settingsService.get('stream_queue_paused', 'false');
    if (paused === 'true') return { status: 'paused' };

    // Check if something is currently displaying
    const current = await this.queueRepo.findOne({
      where: { status: 'displaying' },
      relations: ['supporter'],
    });
    if (current) {
      // Check if stale (>5 min)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (current.display_started_at && current.display_started_at < fiveMinAgo) {
        current.status = 'displayed';
        current.display_ended_at = new Date();
        await this.queueRepo.save(current);
      } else {
        return {
          status: 'displaying',
          item: this.formatQueueItem(current),
        };
      }
    }

    // Grab next with transaction and row locking
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const next = await queryRunner.manager
        .createQueryBuilder(StreamQueue, 'q')
        .setLock('pessimistic_write_or_fail')
        .where('q.status = :status', { status: 'waiting' })
        .orderBy('CASE WHEN q.package_type = \'premium\' THEN 0 ELSE 1 END', 'ASC')
        .addOrderBy('q.queue_position', 'ASC')
        .getOne();

      if (!next) {
        await queryRunner.commitTransaction();
        return { status: 'idle' };
      }

      next.status = 'displaying';
      next.display_started_at = new Date();
      await queryRunner.manager.save(next);
      await queryRunner.commitTransaction();

      // Load supporter relation
      const withSupporter = await this.queueRepo.findOne({
        where: { id: next.id },
        relations: ['supporter'],
      });

      this.eventEmitter.emit('queue.updated');

      return {
        status: 'new',
        item: this.formatQueueItem(withSupporter || next),
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to grab next queue item', err);
      return { status: 'idle' };
    } finally {
      await queryRunner.release();
    }
  }

  async advanceQueue(queueId: string, screenshotUrl?: string) {
    const item = await this.queueRepo.findOne({
      where: { id: queueId },
      relations: ['supporter'],
    });
    if (!item) return { error: 'Queue item not found' };

    item.status = 'displayed';
    item.display_ended_at = new Date();
    if (screenshotUrl) item.screenshot_url = screenshotUrl;
    await this.queueRepo.save(item);

    // Update supporter
    if (item.supporter) {
      item.supporter.display_status = 'displayed';
      item.supporter.displayed_at = new Date();
      if (screenshotUrl) item.supporter.display_screenshot_url = screenshotUrl;
      await this.supporterRepo.save(item.supporter);
    }

    this.eventEmitter.emit('queue.updated');
    return { success: true };
  }

  async saveScreenshot(queueId: string, base64: string) {
    const item = await this.queueRepo.findOne({
      where: { id: queueId },
      relations: ['supporter'],
    });

    let buffer: Buffer = Buffer.from(
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

  async countWaiting(): Promise<number> {
    return this.queueRepo.count({ where: { status: 'waiting' } });
  }

  async getYoutubeViewers() {
    const apiKey = await this.settingsService.getYoutubeApiKey();
    const videoId = await this.settingsService.get('youtube_video_id', '');
    if (!apiKey || !videoId) return { viewer_count: 0, is_live: false, configured: false };

    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,statistics&id=${videoId}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      const video = data.items?.[0];
      if (!video) return { viewer_count: 0, is_live: false, configured: true };

      const concurrent = parseInt(video.liveStreamingDetails?.concurrentViewers || '0', 10);
      const totalViews = parseInt(video.statistics?.viewCount || '0', 10);
      const isLive = !!video.liveStreamingDetails?.concurrentViewers;

      if (concurrent > 0) {
        await this.settingsService.set('current_viewer_count', String(concurrent));
      }

      return { viewer_count: concurrent, total_views: totalViews, is_live: isLive, configured: true };
    } catch (e) {
      this.logger.warn('YouTube API error', e);
      return { viewer_count: 0, is_live: false, error: e.message };
    }
  }

  async trackView(id: string, screenTimeSeconds: number) {
    const item = await this.queueRepo.findOne({ where: { id } });
    if (item) {
      item.total_screen_time_seconds = (item.total_screen_time_seconds || 0) + screenTimeSeconds;
      item.view_count = (item.view_count || 0) + 1;
      await this.queueRepo.save(item);
    }
    return { success: true };
  }

  // Admin operations
  async updateQueueItem(id: string, data: Partial<StreamQueue>) {
    await this.queueRepo.update(id, data);
    this.eventEmitter.emit('queue.updated');
    return this.queueRepo.findOne({ where: { id }, relations: ['supporter'] });
  }

  async skipQueueItem(id: string) {
    await this.queueRepo.update(id, {
      status: 'skipped',
      display_ended_at: new Date(),
    });
    this.eventEmitter.emit('queue.updated');
  }

  async requeueItem(id: string) {
    const maxPos = await this.queueRepo
      .createQueryBuilder('q')
      .select('MAX(q.queue_position)', 'max')
      .getRawOne();
    await this.queueRepo.update(id, {
      status: 'waiting',
      queue_position: (maxPos?.max || 0) + 1,
      display_started_at: null,
      display_ended_at: null,
    });
    this.eventEmitter.emit('queue.updated');
  }

  async calculateEta(supporterId: string): Promise<{
    queue_position: number | null;
    items_ahead: number;
    estimated_seconds: number;
    estimated_display_at: Date | null;
  }> {
    const item = await this.queueRepo.findOne({
      where: { supporter_id: supporterId, status: 'waiting' },
    });

    if (!item) {
      return { queue_position: null, items_ahead: 0, estimated_seconds: 0, estimated_display_at: null };
    }

    // Count items ahead (premium priority, then position)
    const itemsAhead = await this.queueRepo
      .createQueryBuilder('q')
      .where('q.status = :status', { status: 'waiting' })
      .andWhere(
        '(CASE WHEN q.package_type = \'premium\' THEN 0 ELSE 1 END < CASE WHEN :pkgType = \'premium\' THEN 0 ELSE 1 END) OR ' +
        '(CASE WHEN q.package_type = \'premium\' THEN 0 ELSE 1 END = CASE WHEN :pkgType = \'premium\' THEN 0 ELSE 1 END AND q.queue_position < :pos)',
        { pkgType: item.package_type, pos: item.queue_position },
      )
      .getCount();

    // Average display duration from recent items
    const avgResult = await this.queueRepo
      .createQueryBuilder('q')
      .select('AVG(q.display_duration_seconds)', 'avg')
      .where('q.status = :status', { status: 'displayed' })
      .andWhere('q.display_ended_at IS NOT NULL')
      .getRawOne();

    const avgDuration = parseFloat(avgResult?.avg) || 15;
    const estimatedSeconds = Math.ceil(itemsAhead * avgDuration);
    const estimatedDisplayAt = new Date(Date.now() + estimatedSeconds * 1000);

    item.estimated_display_at = estimatedDisplayAt;
    await this.queueRepo.save(item);

    return {
      queue_position: item.queue_position,
      items_ahead: itemsAhead,
      estimated_seconds: estimatedSeconds,
      estimated_display_at: estimatedDisplayAt,
    };
  }

  async clearDisplayed() {
    await this.queueRepo.delete({ status: 'displayed' });
    this.eventEmitter.emit('queue.updated');
  }

  async swapPositions(id1: string, id2: string) {
    const item1 = await this.queueRepo.findOne({ where: { id: id1 } });
    const item2 = await this.queueRepo.findOne({ where: { id: id2 } });
    if (!item1 || !item2) return;
    const temp = item1.queue_position;
    item1.queue_position = item2.queue_position;
    item2.queue_position = temp;
    await this.queueRepo.save([item1, item2]);
    this.eventEmitter.emit('queue.updated');
  }

  async getFullQueue(limit = 200) {
    return this.queueRepo.find({
      relations: ['supporter'],
      order: { queue_position: 'ASC' },
      take: limit,
    });
  }

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
}
