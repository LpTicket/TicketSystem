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

  @Column({ type: 'varchar', nullable: true })
  fileName: string;

  @Column({ type: 'text', nullable: true })
  mobileImageData: string | null;

  @Column({ type: 'varchar', nullable: true })
  mobileFileName: string | null;

  @Column({ type: 'varchar', default: 'banner' })
  bannerType: string;

  @Column({ type: 'varchar', default: 'once' })
  displayMode: string;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', nullable: true })
  linkUrl: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
