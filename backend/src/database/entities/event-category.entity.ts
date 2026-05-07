import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('event_categories')
export class EventCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Machine-readable slug used as Event.category value */
  @Column({ unique: true, length: 40 })
  slug: string;

  @Column({ length: 40 })
  labelEs: string;

  @Column({ length: 40 })
  labelEn: string;

  /** Emoji icon */
  @Column({ length: 10, default: '🎫' })
  icon: string;

  /** Hex colour for category badge */
  @Column({ length: 20, default: '#6366f1' })
  color: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
