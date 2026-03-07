import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('grand_prize_entries')
export class GrandPrizeEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 50 })
  entry_type: string;

  @Column({ type: 'varchar', length: 36 })
  reference_id: string;

  @Column({ type: 'int', default: 0 })
  amount_cents: number;

  @CreateDateColumn()
  created_at: Date;
}
