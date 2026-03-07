import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, CreateDateColumn } from 'typeorm';

@Entity('fundraising_stats')
export class FundraisingStats {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'bigint', default: 0, transformer: { to: (v) => v, from: (v) => Number(v) } })
  total_raised_cents: number;

  @Column({ type: 'bigint', default: 200000000, transformer: { to: (v) => v, from: (v) => Number(v) } })
  goal_amount_cents: number;

  @Column({ type: 'int', default: 0 })
  supporter_count: number;

  @Column({ type: 'int', default: 0 })
  merch_order_count: number;

  @Column({ type: 'int', default: 0 })
  photos_displayed: number;

  @Column({ type: 'int', default: 0 })
  current_viewer_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
