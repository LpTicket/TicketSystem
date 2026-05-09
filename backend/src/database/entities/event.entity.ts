import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum EventCategory {
  TEATRO = 'teatro',
  CONCIERTO = 'concierto',
  CONFERENCIA = 'conferencia',
  DEPORTE = 'deporte',
  INFANTIL = 'infantil',
  FESTIVAL = 'festival',
  COMEDIA = 'comedia',
  OTRO = 'otro',
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  title: string;

  @Column({ unique: true, length: 100 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** Stores a category slug (e.g. 'concierto', 'teatro'). Managed via admin panel. */
  @Column({ type: 'varchar', length: 40, default: 'otro' })
  category: string;

  @Column({ nullable: true, length: 255 })
  imageUrl: string;

  @Column({ nullable: true, length: 255 })
  bannerImageUrl: string;

  @Column({ length: 60 })
  venueName: string;

  @Column({ length: 100, nullable: true })
  venueAddress: string;

  @Column({ type: 'timestamp' })
  eventDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  doorsOpen: Date;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  status: EventStatus;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxPrice: number;

  @Column({ nullable: true, length: 10 })
  currency: string;

  @Column({ type: 'float', nullable: true })
  defaultViewX: number;

  @Column({ type: 'float', nullable: true })
  defaultViewY: number;

  @Column({ type: 'float', nullable: true })
  defaultViewZoom: number;

  @Column({ default: false })
  hasSeatMap: boolean;

  @Column('uuid')
  organizerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'organizerId' })
  organizer: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
