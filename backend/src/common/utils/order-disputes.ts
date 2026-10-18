import { Order, OrderStripeDispute } from '../../database/entities/order.entity';

export function disputeWithholdsPayout(status: string): boolean {
  return status !== 'won' && status !== 'warning_closed';
}

/** Reserve only the proportional ticket-price share; never charge platform fees twice. */
export function organizerDisputeAdjustment(
  order: Pick<Order, 'subtotal' | 'total'>,
  disputes: Record<string, OrderStripeDispute>,
): number {
  const subtotal = Math.max(0, Math.round(Number(order.subtotal) * 100));
  const total = Math.round(Number(order.total) * 100);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(subtotal)) return 0;
  const disputed = Object.values(disputes)
    .filter((dispute) => disputeWithholdsPayout(dispute.status))
    .reduce((sum, dispute) => sum + Math.max(0, Math.round(Number(dispute.amount) * 100)), 0);
  return Math.round(subtotal * Math.min(total, disputed) / total) / 100;
}
