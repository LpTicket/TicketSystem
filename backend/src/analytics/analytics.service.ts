import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AnalyticsPageView } from './analytics-page-view.entity';

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

  async getSummary(days = 7) {
    const safeDays = Math.min(Math.max(Number(days) || 7, 1), 90);
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const [totalViews, uniqueVisitors, topEvents, topPages, recentViews, dailyRows] = await Promise.all([
      this.pageViewRepo.count({ where: { createdAt: MoreThanOrEqual(since) } }),
      this.pageViewRepo
        .createQueryBuilder('view')
        .select('COUNT(DISTINCT view."visitorId")', 'count')
        .where('view."createdAt" >= :since', { since })
        .getRawOne(),
      this.pageViewRepo
        .createQueryBuilder('view')
        .select('view."eventSlug"', 'eventSlug')
        .addSelect('COUNT(*)', 'views')
        .addSelect('COUNT(DISTINCT view."visitorId")', 'visitors')
        .where('view."createdAt" >= :since', { since })
        .andWhere('view."eventSlug" IS NOT NULL')
        .groupBy('view."eventSlug"')
        .orderBy('COUNT(*)', 'DESC')
        .limit(10)
        .getRawMany(),
      this.pageViewRepo
        .createQueryBuilder('view')
        .select('view.path', 'path')
        .addSelect('COUNT(*)', 'views')
        .addSelect('COUNT(DISTINCT view."visitorId")', 'visitors')
        .where('view."createdAt" >= :since', { since })
        .groupBy('view.path')
        .orderBy('COUNT(*)', 'DESC')
        .limit(10)
        .getRawMany(),
      this.pageViewRepo.find({
        where: { createdAt: MoreThanOrEqual(since) },
        order: { createdAt: 'DESC' },
        take: 25,
      }),
      this.pageViewRepo
        .createQueryBuilder('view')
        .select(`TO_CHAR(view."createdAt", 'YYYY-MM-DD')`, 'date')
        .addSelect('COUNT(*)', 'views')
        .addSelect('COUNT(DISTINCT view."visitorId")', 'visitors')
        .where('view."createdAt" >= :since', { since })
        .groupBy(`TO_CHAR(view."createdAt", 'YYYY-MM-DD')`)
        .orderBy('date', 'ASC')
        .getRawMany(),
    ]);

    return {
      days: safeDays,
      totalViews,
      uniqueVisitors: Number(uniqueVisitors?.count || 0),
      topEvents: topEvents.map((item) => ({
        eventSlug: item.eventSlug,
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
