import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FundraisingStats } from './fundraising-stats.entity';
import { Supporter } from './supporter.entity';
import { CustomerStats } from './customer-stats.entity';
import { GrandPrizeEntry } from './grand-prize-entry.entity';

@Injectable()
export class FundraisingService {
  constructor(
    @InjectRepository(FundraisingStats) private statsRepo: Repository<FundraisingStats>,
    @InjectRepository(Supporter) private supporterRepo: Repository<Supporter>,
    @InjectRepository(CustomerStats) private customerStatsRepo: Repository<CustomerStats>,
    @InjectRepository(GrandPrizeEntry) private prizeRepo: Repository<GrandPrizeEntry>,
    private eventEmitter: EventEmitter2,
  ) {}

  async getStats() {
    let stats = await this.statsRepo.findOne({ where: { id: 1 } });
    if (!stats) {
      stats = this.statsRepo.create({ id: 1 });
      await this.statsRepo.save(stats);
    }
    return stats;
  }

  async updateStats(data: Partial<FundraisingStats>) {
    await this.statsRepo.update(1, data);
    const updated = await this.getStats();
    this.eventEmitter.emit('stats.updated', updated);
    return updated;
  }

  async incrementStats(amountCents: number, isPhoto: boolean) {
    const stats = await this.getStats();
    stats.total_raised_cents = Number(stats.total_raised_cents) + amountCents;
    if (isPhoto) {
      stats.supporter_count = (stats.supporter_count || 0) + 1;
    } else {
      stats.merch_order_count = (stats.merch_order_count || 0) + 1;
    }
    await this.statsRepo.save(stats);
    this.eventEmitter.emit('stats.updated', stats);
    return stats;
  }

  async incrementPhotosDisplayed() {
    const stats = await this.getStats();
    stats.photos_displayed = (stats.photos_displayed || 0) + 1;
    await this.statsRepo.save(stats);
    this.eventEmitter.emit('stats.updated', stats);
  }

  async updateViewerCount(count: number) {
    await this.statsRepo.update(1, { current_viewer_count: count });
  }

  async getRecentSupporters() {
    return this.supporterRepo.find({
      where: { payment_status: 'completed' },
      order: { created_at: 'DESC' },
      take: 10,
      select: ['name', 'created_at'],
    });
  }

  async getDisplayedPhotos() {
    return this.supporterRepo.find({
      where: { display_status: 'displayed' },
      order: { displayed_at: 'DESC' },
      take: 12,
      select: ['id', 'photo_url', 'name', 'displayed_at'],
    });
  }

  async trackPurchase(email: string, amountCents: number, isPhoto: boolean, referenceId: string) {
    let cs = await this.customerStatsRepo.findOne({ where: { email } });
    if (!cs) {
      cs = this.customerStatsRepo.create({ email, total_spent_cents: 0 });
    }
    cs.total_spent_cents = Number(cs.total_spent_cents) + amountCents;
    if (isPhoto) {
      cs.photo_purchase_count = (cs.photo_purchase_count || 0) + 1;
    } else {
      cs.merch_purchase_count = (cs.merch_purchase_count || 0) + 1;
    }
    const entries = Math.floor(amountCents / 1000);
    cs.grand_prize_entries = (cs.grand_prize_entries || 0) + Math.max(entries, 1);
    await this.customerStatsRepo.save(cs);

    for (let i = 0; i < Math.max(entries, 1); i++) {
      const entry = this.prizeRepo.create({
        email,
        entry_type: isPhoto ? 'photo' : 'merch',
        reference_id: referenceId,
        amount_cents: amountCents,
      });
      await this.prizeRepo.save(entry);
    }
  }

  async countPrizeEntries(email?: string): Promise<number> {
    if (email) {
      return this.prizeRepo.count({ where: { email } });
    }
    return this.prizeRepo.count();
  }

  async getSupporters(limit = 200) {
    return this.supporterRepo.find({
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async getCustomerStats(limit = 50) {
    return this.customerStatsRepo.find({
      order: { total_spent_cents: 'DESC' },
      take: limit,
    });
  }

  async getPrizeEntries(limit = 100) {
    return this.prizeRepo.find({
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async updateSupporter(id: string, data: Partial<Supporter>) {
    await this.supporterRepo.update(id, data);
    return this.supporterRepo.findOne({ where: { id } });
  }

  async findSupporterBySessionId(sessionId: string) {
    return this.supporterRepo.findOne({ where: { stripe_checkout_session_id: sessionId } });
  }

  async createSupporter(data: Partial<Supporter>) {
    const supporter = this.supporterRepo.create(data);
    return this.supporterRepo.save(supporter);
  }
}
