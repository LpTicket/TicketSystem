import api from './api';

export type SpecialCodeSale = {
  id: string;
  code: string;
  eventTitle: string;
  buyerName: string;
  buyerEmail: string;
  ticketCount: number;
  total: number;
  currency: string;
  purchasedAt: string;
};

export async function validateSpecialCode(code: string, eventId: string) {
  const { data } = await api.get('/special-codes/validate', { params: { code, eventId } });
  return data;
}

export async function getMySpecialCodeSales() {
  const { data } = await api.get<SpecialCodeSale[]>('/special-codes/my-sales');
  return data;
}
