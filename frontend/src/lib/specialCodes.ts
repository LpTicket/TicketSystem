import api from './api';

export type SpecialCodeSale = {
  id: string;
  specialCode: string | null;
  eventTitle: string;
  buyerName: string;
  buyerEmail: string;
  ticketCount: number;
  total: number;
  purchasedAt: string;
};

export type SpecialCodeValidation = {
  id: string;
  code: string;
  ownerUserId: string;
  eventId?: string | null;
};

export async function validateSpecialCode(code: string, eventId: string) {
  const { data } = await api.get<SpecialCodeValidation>('/special-codes/validate', {
    params: { code, eventId },
  });
  return data;
}

export async function getMySpecialCodeSales() {
  const { data } = await api.get<SpecialCodeSale[]>('/special-codes/me/sales');
  return data;
}
