import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { EmailCampaignRecipient } from './email-campaign-recipient.entity';

export type EmailCampaignStatus = 'queued' | 'processing' | 'paused' | 'completed';

@Entity('email_campaigns')
export class EmailCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  preheader: string | null;

  @Column({ type: 'text', nullable: true })
  imageData: string | null;

  @Column({ type: 'text', nullable: true })
  link: string | null;

  @Column({ type: 'varchar', default: 'queued' })
  status: EmailCampaignStatus;

  @Column({ type: 'integer', default: 0 })
  totalRecipients: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => EmailCampaignRecipient, (recipient) => recipient.campaign)
  recipients: EmailCampaignRecipient[];
}
