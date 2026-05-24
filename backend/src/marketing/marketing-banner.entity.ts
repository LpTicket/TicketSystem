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
  fileName: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
