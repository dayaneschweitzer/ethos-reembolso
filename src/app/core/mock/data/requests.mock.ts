import { RequestListItem } from '../../models/request.model';

export const REQUESTS_SEED: RequestListItem[] = [
  { id: 'req_2025_000125', type: 'Adiantamento', costCenter: 'TI & Inovação', date: '01/02/2025', total: 1500.00, status: 'Aprovado' },
  { id: 'req_2025_000123', type: 'Reembolso',   costCenter: 'Obra Alpha',   date: '15/01/2025', total: 116.00,  status: 'Em Aprovação' },
  { id: 'req_2025_000120', type: 'Reembolso',   costCenter: 'Obra Alpha',   date: '01/12/2024', total: 55.00,   status: 'Pago' },
];
