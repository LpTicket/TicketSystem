import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('analytics_page_views')
@Index(['createdAt'])
@Index(['eventSlug'])
@Index(['path'])
@Index(['visitorId'])
export class AnalyticsPageView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  visitorId: string;

  @Column({ type: 'varchar', length: 300 })
  path: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  eventSlug: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  language: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  referrerHost: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  deviceType: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
