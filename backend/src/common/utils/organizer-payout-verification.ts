import type { Order } from '../../database/entities/order.entity';

export type OrganizerPayoutVerification = {
  eventId: string;
  currency: string;
  verifiedAt: number;
  orders: Array<{ id: string; fingerprint: string; excludedTicketAmount: number }>;
};

// Bind the Stripe check to the paid rows used by the final, short DB transaction.
// Network requests never hold a database lock needed by ticket sales.
export function payoutOrderFingerprint(order: Order): string {
  return JSON.stringify([
    order.id, order.eventId, order.status, Number(order.total), Number(order.subtotal),
    order.stripePaymentIntent || null, order.stripeSessionId || null,
    Number(order.organizerProcessingAdjustment || 0), Number(order.organizerDisputeAdjustment || 0),
    order.paymentMethodType || null, order.stripeFeeReconciliationStatus || 'not_required',
  ]);
}
