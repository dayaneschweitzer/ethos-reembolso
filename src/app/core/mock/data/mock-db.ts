import { REQUESTS_SEED } from './requests.mock';
import { RequestListItem } from '../../models/request.model';

function nextId(): string {
  const n = Math.floor(Math.random() * 900000 + 100000);
  const year = new Date().getFullYear();
  return `req_${year}_${n}`;
}

export const REQUESTS_DB = (() => {
  const data: RequestListItem[] = [...REQUESTS_SEED];

  return {
    list: () => [...data],
    addFromMovementPayload: (payload: any) => {
      const total = Number(payload?.grossValue ?? 0);
      const dateISO = String(payload?.registerDate ?? new Date().toISOString());
      const ddmmyyyy = new Date(dateISO).toLocaleDateString('pt-BR');

      const item: RequestListItem = {
        id: nextId(),
        type: 'Reembolso',
        costCenter: payload?.costCenterCode ?? '05.001',
        date: ddmmyyyy,
        total,
        status: 'Em Aprovação',
      };

      data.unshift(item);
      return { ok: true, created: item };
    },
  };
})();
