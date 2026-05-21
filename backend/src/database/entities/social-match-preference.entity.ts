import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './user.entity';
import { Event } from './event.entity';

export enum SocialMatchInterest {
  PROFESSIONAL_NETWORKING = 'professional_networking',
  MAKE_FRIENDS = 'make_friends',
  MUSIC_PARTY = 'music_party',
  BUSINESS = 'business',
  COLLABORATIONS = 'collaborations',
  SINGLES = 'singles',
  VIP_EXPERIENCE = 'vip_experience',
  OTHER = 'other',
}

@Entity('social_match_preferences')
@Unique(['userId', 'eventId'])
export class SocialMatchPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  eventId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'simple-array', nullable: true })
  interests: SocialMatchInterest[] | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  industry: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  instagram: string | null;

  @Column({ default: true })
  privateMode: boolean;

  @Column({ default: false })
  invisibleMode: boolean;

  @Column({ default: false })
  shareInstagram: boolean;

  @Column({ default: false })
  shareLocation: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
