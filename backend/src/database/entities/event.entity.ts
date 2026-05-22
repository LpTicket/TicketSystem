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

/**
 * EventStatus
 * Defines the lifecycle of an event in the system.
 */
export enum EventStatus {
  DRAFT = 'draft',               // Initial state, invisible to buyers
  PENDING_APPROVAL = 'pending_approval', // Waiting for admin review
  PUBLISHED = 'published',       // Live and purchasable
  CANCELLED = 'cancelled',       // Event cancelled by organizer/admin
  COMPLETED = 'completed',       // Event date has passed
}

/**
 * EventCategory
 * Legacy enum for categories. 
 * Note: The system now primarily uses dynamic slugs from the categories table.
 */
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

/**
 * Event Entity
 * Represents a show or gathering hosted on the platform.
 * Includes sophisticated "pending approval" logic to allow organizers to 
 * propose changes to live events without immediate public modification.
 */
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

  /** 
   * Stores a category slug (e.g. 'concierto', 'teatro'). 
   * References the slug field in the EventCategoryEntity.
   */
  @Column({ type: 'varchar', length: 40, default: 'otro' })
  category: string;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'text', nullable: true })
  bannerImageUrl: string | null;

  /** CSS background-position value for the banner (e.g., 'top center' or '50% 50%') */
  @Column({ type: 'varchar', length: 50, nullable: true, default: '50% 50%' })
  bannerPosition: string | null;

  @Column({ length: 60 })
  venueName: string;

  @Column({ length: 100, nullable: true })
  venueAddress: string;

  @Column({ type: 'timestamp' })
  eventDate: Date;

  @Column({ length: 50, default: 'UTC' })
  eventTimezone: string;

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

  /** Denotes the cheapest ticket price available for search sorting */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxPrice: number;

  @Column({ nullable: true, length: 10 })
  currency: string;

  // --- Configurable Fee Parameters ---
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  serviceFeePercent: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  serviceFeeFixedPerTicket: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  processingFeePercent: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  processingFeeFixedPerTicket: number | null;

  @Column({ type: 'int', default: 10 })
  maxTicketsPerTransaction: number;

  // --- Map Viewport Settings (Frontend Camera Defaults) ---
  @Column({ type: 'float', nullable: true })
  defaultViewX: number;

  @Column({ type: 'float', nullable: true })
  defaultViewY: number;

  @Column({ type: 'float', nullable: true })
  defaultViewZoom: number;

  @Column({ default: false })
  hasSeatMap: boolean;

  @Column({ default: false })
  showStage: boolean;

  // --- Creator Code Commission ---
  /** Fixed amount paid to creator/influencer code owners per ticket sold at this event */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  creatorCommission: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pendingCreatorCommission: number | null;

  // --- Pending Approval Logic ---
  /**
   * When an organizer edits a 'PUBLISHED' event, the new values are saved here.
   * An admin must review and "apply" these changes to promote them to the main fields.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  pendingTitle: string | null;

  @Column({ type: 'text', nullable: true })
  pendingDescription: string | null;

  @Column({ type: 'text', nullable: true })
  pendingImageUrl: string | null;

  @Column({ type: 'text', nullable: true })
  pendingBannerImageUrl: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  pendingVenueName: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  pendingCategory: string | null;

  @Column({ type: 'timestamp', nullable: true })
  pendingEventDate: Date | null;

  @Column({ default: false })
  autoReminderEnabled: boolean;

  @Column({ type: 'int', default: 0 })
  autoReminderDays: number;

  @Column({ type: 'text', nullable: true })
  autoReminderMessage: string | null;

  @Column({ default: false })
  autoReminderSent: boolean;

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
