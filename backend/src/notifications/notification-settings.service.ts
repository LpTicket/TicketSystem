import { BadRequestException, ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NOTIFICATION_CATALOG, NotificationKey, notificationDefault } from './notification-catalog';
import { NotificationSettings } from './notification-settings.entity';
import { UpdateNotificationSettingsDto } from './notification-settings.dto';

@Injectable()
export class NotificationSettingsService {
  private readonly logger = new Logger(NotificationSettingsService.name);
  private warnedMissingTable = false;

  constructor(@InjectRepository(NotificationSettings) private readonly repo: Repository<NotificationSettings>) {}

  private async read() {
    const settings = await this.repo.findOneBy({ id: 'global' });
    if (!settings) throw new ServiceUnavailableException('Falta preparar la configuración de notificaciones en la base de datos.');
    return settings;
  }

  private serialize(settings: NotificationSettings) {
    return {
      version: settings.version,
      updatedAt: settings.updatedAt,
      items: NOTIFICATION_CATALOG.map((item) => ({ ...item, enabled: settings.preferences[item.key] ?? notificationDefault(item.key) })),
    };
  }

  async getSettings() {
    return this.serialize(await this.read());
  }

  async update(dto: UpdateNotificationSettingsDto, adminId: string) {
    return this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(NotificationSettings);
      const settings = await repo.findOne({ where: { id: 'global' }, lock: { mode: 'pessimistic_write' } });
      if (!settings) throw new ServiceUnavailableException('Falta preparar la configuración de notificaciones.');
      if (settings.version !== dto.version) throw new ConflictException('Otro administrador cambió la configuración. Recarga antes de guardar.');
      const preferences = { ...settings.preferences };
      for (const change of dto.changes) preferences[change.key] = change.enabled;
      settings.preferences = preferences;
      settings.version += 1;
      settings.updatedBy = adminId;
      return this.serialize(await repo.save(settings));
    });
  }

  async isEnabled(key: NotificationKey): Promise<boolean> {
    try {
      const settings = await this.read();
      return settings.preferences[key] ?? notificationDefault(key);
    } catch (error) {
      // Preserve existing delivery during a staged rollout before the SQL is applied.
      // Other database failures must not silently bypass saved preferences.
      if ((error as { driverError?: { code?: string } })?.driverError?.code !== '42P01') throw error;
      if (!this.warnedMissingTable) {
        this.logger.warn('Falta aplicar add-notification-settings.sql; se conservan los envíos existentes.');
        this.warnedMissingTable = true;
      }
      return notificationDefault(key);
    }
  }

  async requireEnabled(key: NotificationKey) {
    if (!await this.isEnabled(key)) throw new BadRequestException('Esta notificación está desactivada por administración.');
  }
}
