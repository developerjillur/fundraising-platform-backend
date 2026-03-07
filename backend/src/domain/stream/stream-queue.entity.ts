import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Supporter } from '../fundraising/supporter.entity';

@Entity('stream_queue')
export class StreamQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  supporter_id: string;

  @Column({ type: 'text' })
  photo_url: string;

  @Column({ type: 'text', nullable: true })
  photo_storage_path: string;

  @Column({ type: 'enum', enum: ['standard', 'premium'] })
  package_type: string;

  @Column({ type: 'int' })
  display_duration_seconds: number;

  @Column({ type: 'boolean', default: false })
  has_badge: boolean;

  @Column({ type: 'int' })
  queue_position: number;

  @Column({ type: 'enum', enum: ['waiting', 'displaying', 'displayed', 'skipped'], default: 'waiting' })
  status: string;

  @Column({ type: 'datetime', nullable: true })
  estimated_display_at: Date;

  @Column({ type: 'datetime', nullable: true })
  display_started_at: Date;

  @Column({ type: 'datetime', nullable: true })
  display_ended_at: Date;

  @Column({ type: 'text', nullable: true })
  screenshot_url: string;

  @Column({ type: 'int', default: 0 })
  total_screen_time_seconds: number;

  @Column({ type: 'int', default: 0 })
  view_count: number;

  @ManyToOne(() => Supporter)
  @JoinColumn({ name: 'supporter_id' })
  supporter: Supporter;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
