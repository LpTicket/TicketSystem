import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('marketing_banners')
export class MarketingBanner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'home' })
  placement: string;

  @Column({ default: 'Banner Home' })
  title: string;

  @Column({ type: 'text' })
  imageData: string;

  @Column({ nullable: true })
  fileName: string | null;

  @Column({ nullable: true })
  linkUrl: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
