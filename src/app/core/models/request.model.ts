export type RequestType = 'Reembolso' | 'Adiantamento';

export interface RequestListItem {
  id: string;
  type: RequestType;
  costCenter: string;
  date: string;   // dd/MM/yyyy
  total: number;
  status: 'Em Aprovação' | 'Aprovado' | 'Pago';
}
