import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { EmailCampaign } from './email-campaign.entity';

export type EmailCampaignRecipientStatus = 'queued' | 'sent' | 'failed' | 'opened';

@Entity('email_campaign_recipients')
@Unique(['campaignId', 'email'])
export class EmailCampaignRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  campaignId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  openToken: string;

  @Index()
  @Column({ type: 'varchar', default: 'queued' })
  status: EmailCampaignRecipientStatus;

  @Column({ type: 'text', nullable: true })
  sendError: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  openedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => EmailCampaign, (campaign) => campaign.recipients, { onDelete: 'CASCADE' })
  campaign: EmailCampaign;
}
