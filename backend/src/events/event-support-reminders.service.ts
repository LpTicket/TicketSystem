import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Event, EventStatus } from '../database/entities/event.entity';
import { MailService } from '../common/services/mail.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCK_NAMESPACE = 240024;

@Injectable()
export class EventSupportRemindersService {
  private readonly logger = new Logger(EventSupportRemindersService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  // One-minute precision, including morning events. The full remaining window
  // allows recovery after downtime and events published less than 24h ahead.
  @Cron('0 * * * * *', { waitForCompletion: true })
  async handleReminders(): Promise<void> {
    const now = new Date();
    const events = await this.dataSource.getRepository(Event)
      .createQueryBuilder('event')
      .select('event.id')
      .where('event.status = :status', { status: EventStatus.PUBLISHED })
      .andWhere('event.eventDate > :now AND event.eventDate <= :deadline', {
        now, deadline: new Date(now.getTime() + DAY_MS),
      })
      .andWhere(`("event"."organizerSupportReminderForDate" IS DISTINCT FROM "event"."eventDate"
        OR "event"."adminSupportReminderForDate" IS DISTINCT FROM "event"."eventDate")`)
      .getMany();

    for (const event of events) {
      try {
        await this.sendPendingReminders(event.id);
      } catch {
        // Never log organizer contact details or SMTP credentials.
        this.logger.error(`No se pudo procesar el recordatorio del evento ${event.id}`);
      }
    }
  }

  private async sendPendingReminders(eventId: string): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    let locked = false;
    try {
      await runner.connect();
      // A session lock covers SMTP and individual checkpoints across replicas.
      const [result] = await runner.query(
        'SELECT pg_try_advisory_lock($1, hashtext($2)) AS locked',
        [LOCK_NAMESPACE, eventId],
      );
      locked = result?.locked === true;
      if (!locked) return;

      const repo = runner.manager.getRepository(Event);
      for (const audience of ['organizer', 'admin'] as const) {
        // Re-read after acquiring the lock and between recipients so a cancelled
        // or rescheduled event is not processed from an old candidate snapshot.
        const event = await repo.findOne({
          where: { id: eventId },
          relations: { organizer: true },
          select: {
            id: true, title: true, eventDate: true, eventTimezone: true,
            status: true, venueName: true, venueAddress: true, organizerId: true,
            organizerSupportReminderForDate: true, adminSupportReminderForDate: true,
            organizer: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
        });
        if (!event || event.status !== EventStatus.PUBLISHED) return;
        const timeLeft = event.eventDate.getTime() - Date.now();
        if (timeLeft <= 0 || timeLeft > DAY_MS) return;

        const field = audience === 'organizer'
          ? 'organizerSupportReminderForDate'
          : 'adminSupportReminderForDate';
        if (event[field]?.getTime() === event.eventDate.getTime()) continue;

        const to = audience === 'organizer'
          ? event.organizer?.email?.trim()
          : String(this.config.get('ADMIN_EMAIL') || 'info@lpticket.com').trim();
        if (!to) {
          this.logger.warn(`Falta destinatario ${audience} para el evento ${eventId}`);
          continue;
        }

        const sent = await this.mailService.sendEventSupportReminder(to, {
          eventTitle: event.title,
          eventDate: event.eventDate,
          eventTimezone: event.eventTimezone,
          venueName: event.venueName,
          venueAddress: event.venueAddress,
          organizerName: [event.organizer?.firstName, event.organizer?.lastName].filter(Boolean).join(' ') || 'Organizador',
          organizerEmail: event.organizer?.email || '',
          organizerPhone: event.organizer?.phone,
        }, audience);

        if (sent) {
          // Persist each recipient immediately; retry only unsent recipients.
          await repo.update({
            id: eventId, eventDate: event.eventDate,
            status: EventStatus.PUBLISHED, organizerId: event.organizerId,
          }, { [field]: event.eventDate });
        } else {
          this.logger.warn(`Envío ${audience} pendiente para el evento ${eventId}`);
        }
      }
    } finally {
      try {
        if (locked) {
          await runner.query('SELECT pg_advisory_unlock($1, hashtext($2))', [LOCK_NAMESPACE, eventId]);
        }
      } finally {
        await runner.release();
      }
    }
  }
}
