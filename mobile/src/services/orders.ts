/**
 * orders (mobile)
 * EN: Purchase/checkout and ticket-related calls for the mobile app — create
 *     orders, fetch my tickets/orders and ticket details.
 * ES: Llamadas de compra/checkout y de tickets para la app móvil — crear
 *     órdenes, obtener mis tickets/órdenes y el detalle de un ticket.
 */
import { apiPost, apiGet } from './api';

export type CheckoutPayload = {
  eventId: string;
  sectionId?: string;
  seatIds?: string[];
  quantity?: number;
  specialCode?: string;
  buyerEmail?: string;
  buyerName?: string;
};

export type CheckoutSession = {
  url: string;
  sessionId: string;
};

/** Creates a real Stripe Checkout session on the backend and returns its URL. */
export async function createCheckout(payload: CheckoutPayload): Promise<CheckoutSession> {
  return apiPost<CheckoutSession>('/orders/checkout', payload);
}

/** Locks seats on the server for 10 minutes (same as web). */
export async function lockSeats(seatIds: string[]): Promise<void> {
  return apiPost('/events/seats/lock', { seatIds });
}

/** Releases all locks held by the current session. */
export async function unlockSeats(): Promise<void> {
  return apiPost('/events/seats/unlock', {});
}

/** Fetches the invoice preview with real fees from the backend. */
export async function previewInvoice(params: { eventId: string; seatIds?: string; sectionId?: string; quantity?: number }): Promise<any> {
  return apiGet('/orders/preview-invoice', params);
}
