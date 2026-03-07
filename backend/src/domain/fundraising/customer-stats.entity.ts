import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('customer_stats')
export class CustomerStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'bigint', default: 0, transformer: { to: (v) => v, from: (v) => Number(v) } })
  total_spent_cents: number;

  @Column({ type: 'int', default: 0 })
  photo_purchase_count: number;

  @Column({ type: 'int', default: 0 })
  merch_purchase_count: number;

  @Column({ type: 'int', default: 0 })
  grand_prize_entries: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
