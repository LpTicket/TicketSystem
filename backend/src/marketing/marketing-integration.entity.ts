import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Stores provider credentials encrypted at rest, never returned by an API. */
@Entity('marketing_integrations')
export class MarketingIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  provider: string;

  @Column({ type: 'text' })
  encryptedRefreshToken: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
