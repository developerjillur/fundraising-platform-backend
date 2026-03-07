import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('supporters')
export class Supporter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255 })
  email: string;

  @Column({ type: 'text', nullable: true })
  photo_url: string;

  @Column({ type: 'text', nullable: true })
  photo_storage_path: string;

  @Column({ type: 'enum', enum: ['standard', 'premium'], nullable: true })
  package_type: string;

  @Column({ type: 'int', default: 0 })
  amount_cents: number;

  @Column({ type: 'int', nullable: true })
  display_duration_seconds: number;

  @Column({ type: 'enum', enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' })
  payment_status: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_checkout_session_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_payment_intent_id: string;

  @Column({ type: 'enum', enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  moderation_status: string;

  @Column({ type: 'text', nullable: true })
  moderation_reason: string;

  @Column({ type: 'enum', enum: ['queued', 'displaying', 'displayed', 'skipped'], nullable: true })
  display_status: string;

  @Column({ type: 'datetime', nullable: true })
  estimated_display_at: Date;

  @Column({ type: 'datetime', nullable: true })
  displayed_at: Date;

  @Column({ type: 'text', nullable: true })
  display_screenshot_url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
