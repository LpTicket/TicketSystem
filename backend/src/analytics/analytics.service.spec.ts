import { AnalyticsService } from './analytics.service';

function queryBuilder(rawOne: unknown = undefined, rawMany: unknown[] = []) {
  const builder: any = {};
  for (const method of ['select', 'addSelect', 'where', 'andWhere', 'leftJoin', 'groupBy', 'orderBy', 'addOrderBy', 'limit']) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.getRawOne = jest.fn().mockResolvedValue(rawOne);
  builder.getRawMany = jest.fn().mockResolvedValue(rawMany);
  return builder;
}

describe('AnalyticsService', () => {
  it('uses a PostgreSQL-safe alias for order analytics queries', async () => {
    const pageBuilders = [
      queryBuilder({ count: '3' }),
      queryBuilder(undefined, [{ eventSlug: 'sample-event', views: '5', visitors: '3' }]),
      queryBuilder(undefined, [{ path: '/events/sample-event', views: '5', visitors: '3' }]),
      queryBuilder(undefined, [{ date: '2026-09-05', views: '5', visitors: '3' }]),
    ];
    const orderBuilders = [
      queryBuilder({
        paidOrders: '2',
        totalCharged: '100',
        ticketSales: '90',
        klarnaOrders: '1',
        klarnaTotalCharged: '50',
        klarnaTicketSales: '45',
        organizerProcessingAdjustments: '2',
        pendingFeeReconciliations: '0',
      }),
      queryBuilder(undefined, []),
    ];
    const pageViewRepo = {
      createQueryBuilder: jest.fn(() => pageBuilders.shift()),
      count: jest.fn().mockResolvedValue(5),
      find: jest.fn().mockResolvedValue([]),
    };
    const eventRepo = {
      find: jest.fn().mockResolvedValue([{ slug: 'sample-event', title: 'Sample Event' }]),
    };
    const orderRepo = {
      createQueryBuilder: jest.fn(() => orderBuilders.shift()),
    };
    const service = new AnalyticsService(pageViewRepo as any, eventRepo as any, orderRepo as any);

    const summary = await service.getSummary(7);

    expect(orderRepo.createQueryBuilder).toHaveBeenNthCalledWith(1, 'ord');
    expect(orderRepo.createQueryBuilder).toHaveBeenNthCalledWith(2, 'ord');
    expect(summary.totalViews).toBe(5);
    expect(summary.financial).toMatchObject({ paidOrders: 2, klarnaOrders: 1, organizerNetTicketSales: 88 });
  });
});
