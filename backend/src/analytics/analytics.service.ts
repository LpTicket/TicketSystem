/**
 * AnalyticsService
 * EN: Records page views and produces summaries (unique visitors, top pages,
 *     views over time) used by the admin analytics dashboard.
 * ES: Registra vistas de página y genera resúmenes (visitantes únicos, páginas
 *     más vistas, vistas a lo largo del tiempo) usados por el panel de analítica
 *     del admin.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AnalyticsPageView } from './analytics-page-view.entity';
import { Event } from '../database/entities/event.entity';

type TrackViewDto = {
  visitorId?: string;
  path?: string;
  eventSlug?: string | null;
  language?: string | null;
  referrer?: string | null;
  deviceType?: string | null;
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsPageView)
    private readonly pageViewRepo: Repository<AnalyticsPageView>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  private cleanText(value: unknown, max: number) {
    const text = String(value || '').trim();
    return text ? text.slice(0, max) : null;
  }

  private getReferrerHost(referrer?: string | null) {
    if (!referrer) return null;
    try {
      return new URL(referrer).host.slice(0, 80);
    } catch {
      return this.cleanText(referrer, 80);
    }
  }

  private formatEventSlug(slug: string | null | undefined) {
    if (!slug) return null;
    const parts = slug
      .split(/[/-]+/)
      .filter(Boolean)
      .filter((word, index, words) => {
        const isLast = index === words.length - 1;
        return !(isLast && /^[a-z0-9]{8,}$/i.test(word));
      });

    return parts
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async trackView(dto: TrackViewDto) {
    const visitorId = this.cleanText(dto.visitorId, 120);
    const path = this.cleanText(dto.path, 300);
    if (!visitorId || !path) return { ok: true, skipped: true };

    await this.pageViewRepo.save(
      this.pageViewRepo.create({
        visitorId,
        path,
        eventSlug: this.cleanText(dto.eventSlug, 120),
        language: this.cleanText(dto.language, 20),
        referrerHost: this.getReferrerHost(dto.referrer),
        deviceType: this.cleanText(dto.deviceType, 40),
      }),
    );

    return { ok: true };
  }

  async getSummary(days = 7, eventSlug?: string) {
    const safeDays = Math.min(Math.max(Number(days) || 7, 1), 90);
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    const cleanEventSlug = this.cleanText(eventSlug, 120);
    const baseWhere = cleanEventSlug
      ? { createdAt: MoreThanOrEqual(since), eventSlug: cleanEventSlug }
      : { createdAt: MoreThanOrEqual(since) };

    const uniqueVisitorsQuery = this.pageViewRepo
      .createQueryBuilder('view')
      .select('COUNT(DISTINCT view."visitorId")', 'count')
      .where('view."createdAt" >= :since', { since });
    if (cleanEventSlug) uniqueVisitorsQuery.andWhere('view."eventSlug" = :eventSlug', { eventSlug: cleanEventSlug });

    const topEventsQuery = this.pageViewRepo
      .createQueryBuilder('view')
      .select('view."eventSlug"', 'eventSlug')
      .addSelect('COUNT(*)', 'views')
      .addSelect('COUNT(DISTINCT view."visitorId")', 'visitors')
      .where('view."createdAt" >= :since', { since })
      .andWhere('view."eventSlug" IS NOT NULL');
    if (cleanEventSlug) topEventsQuery.andWhere('view."eventSlug" = :eventSlug', { eventSlug: cleanEventSlug });

    const topPagesQuery = this.pageViewRepo
      .createQueryBuilder('view')
      .select('view.path', 'path')
      .addSelect('COUNT(*)', 'views')
      .addSelect('COUNT(DISTINCT view."visitorId")', 'visitors')
      .where('view."createdAt" >= :since', { since });
    if (cleanEventSlug) topPagesQuery.andWhere('view."eventSlug" = :eventSlug', { eventSlug: cleanEventSlug });

    const dailyQuery = this.pageViewRepo
      .createQueryBuilder('view')
      .select(`TO_CHAR(view."createdAt", 'YYYY-MM-DD')`, 'date')
      .addSelect('COUNT(*)', 'views')
      .addSelect('COUNT(DISTINCT view."visitorId")', 'visitors')
      .where('view."createdAt" >= :since', { since });
    if (cleanEventSlug) dailyQuery.andWhere('view."eventSlug" = :eventSlug', { eventSlug: cleanEventSlug });

    const [totalViews, uniqueVisitors, topEvents, topPages, recentViews, dailyRows] = await Promise.all([
      this.pageViewRepo.count({ where: baseWhere }),
      uniqueVisitorsQuery.getRawOne(),
      topEventsQuery
        .groupBy('view."eventSlug"')
        .orderBy('COUNT(*)', 'DESC')
        .limit(10)
        .getRawMany(),
      topPagesQuery
        .groupBy('view.path')
        .orderBy('COUNT(*)', 'DESC')
        .limit(10)
        .getRawMany(),
      this.pageViewRepo.find({
        where: baseWhere,
        order: { createdAt: 'DESC' },
        take: 25,
      }),
      dailyQuery
        .groupBy(`TO_CHAR(view."createdAt", 'YYYY-MM-DD')`)
        .orderBy('date', 'ASC')
        .getRawMany(),
    ]);

    const eventSlugs = topEvents.map((item) => item.eventSlug).filter(Boolean);
    const events = eventSlugs.length
      ? await this.eventRepo.find({
          where: eventSlugs.map((slug) => ({ slug })),
          select: ['slug', 'title'],
        })
      : [];
    const eventTitlesBySlug = new Map(events.map((event) => [event.slug, event.title]));

    return {
      days: safeDays,
      totalViews,
      uniqueVisitors: Number(uniqueVisitors?.count || 0),
      topEvents: topEvents.map((item) => ({
        eventSlug: item.eventSlug,
        eventTitle: eventTitlesBySlug.get(item.eventSlug) || this.formatEventSlug(item.eventSlug),
        views: Number(item.views || 0),
        visitors: Number(item.visitors || 0),
      })),
      topPages: topPages.map((item) => ({
        path: item.path,
        views: Number(item.views || 0),
        visitors: Number(item.visitors || 0),
      })),
      daily: dailyRows.map((item) => ({
        date: item.date,
        views: Number(item.views || 0),
        visitors: Number(item.visitors || 0),
      })),
      recentViews,
    };
  }
}
