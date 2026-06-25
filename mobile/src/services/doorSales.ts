/**
 * doorSales (mobile)
 * EN: In-person door-sale flow — preview a custom-amount sale and create the
 *     checkout/intent (works with Stripe Terminal / Tap to Pay, see tapToPay).
 * ES: Flujo de venta en puerta presencial — previsualizar una venta de monto
 *     personalizado y crear el checkout/intent (funciona con Stripe Terminal /
 *     Tap to Pay, ver tapToPay).
 */
import { apiGet, apiPost } from './api';

export type DoorSalePreview = {
  unitPrice: number;
  quantity: number;
  baseTotal: number;
  lpFee: number;
  processingFee: number;
  total: number;
  event?: {
    id: string;
    title: string;
    venueName?: string;
    eventDate?: string;
    currency?: string;
  };
  section?: { id: string; name: string; type?: string } | null;
};

export type DoorSaleCheckout = DoorSalePreview & {
  sessionId: string;
  url: string;
  qrData: string;
};

export type DoorSaleTapToPayIntent = {
  orderId: string;
  paymentIntentId: string;
  clientSecret: string;
  locationId: string;
  invoice: DoorSalePreview;
  event?: DoorSalePreview['event'];
};

export async function previewDoorSale(params: {
  eventId: string;
  amount: number;
  quantity?: number;
  sectionId?: string;
}): Promise<DoorSalePreview> {
  return apiGet<DoorSalePreview>('/orders/door-sale/preview', params);
}

export async function createDoorSaleCheckout(payload: {
  eventId: string;
  amount: number;
  quantity?: number;
  sectionId?: string;
  buyerEmail?: string;
  buyerName?: string;
}): Promise<DoorSaleCheckout> {
  return apiPost<DoorSaleCheckout>('/orders/door-sale/checkout', payload);
}

export async function createDoorSaleTapToPayIntent(payload: {
  eventId: string;
  amount: number;
  quantity?: number;
}): Promise<DoorSaleTapToPayIntent> {
  return apiPost<DoorSaleTapToPayIntent>('/orders/door-sale/tap-to-pay-intent', payload);
}

export async function completeDoorSaleTapToPay(payload: {
  orderId: string;
  paymentIntentId: string;
}): Promise<{ success: boolean; orderId: string }> {
  return apiPost<{ success: boolean; orderId: string }>('/orders/door-sale/tap-to-pay-complete', payload);
}

export async function getTerminalConnectionToken(): Promise<{ secret: string }> {
  return apiPost<{ secret: string }>('/orders/terminal/connection-token');
}
