import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MarketingEmailCampaignStatus {
  DRAFT = 'draft',
  TESTED = 'tested',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  SENT = 'sent',
  CANCELLED = 'cancelled',
}

export enum MarketingEmailAudience {
  ALL_USERS = 'all_users',
  ALL_BUYERS = 'all_buyers',
  EVENT_BUYERS = 'event_buyers',
}

@Entity('marketing_email_campaigns')
@Index(['status'])
@Index(['audience'])
@Index(['scheduledAt'])
export class MarketingEmailCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ length: 160 })
  subject: string;

  @Column({ length: 180, nullable: true })
  preheader: string | null;

  @Column({ type: 'text' })
  imageData: string;

  @Column({ length: 180, nullable: true })
  imageFileName: string | null;

  @Column({ length: 120, nullable: true })
  headline: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ length: 60, nullable: true })
  buttonText: string | null;

  @Column({ type: 'text', nullable: true })
  buttonUrl: string | null;

  @Column({ type: 'varchar', length: 40, default: MarketingEmailAudience.ALL_USERS })
  audience: MarketingEmailAudience;

  @Column({ type: 'uuid', nullable: true })
  eventId: string | null;

  @Column({ type: 'varchar', length: 30, default: MarketingEmailCampaignStatus.DRAFT })
  status: MarketingEmailCampaignStatus;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastTestSentAt: Date | null;

  @Column({ type: 'int', default: 0 })
  estimatedRecipients: number;

  @Column({ type: 'int', default: 0 })
  sentCount: number;

  @Column({ type: 'int', default: 0 })
  failedCount: number;

  @Column({ type: 'int', default: 0 })
  openedCount: number;

  @Column({ type: 'int', default: 0 })
  clickedCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
