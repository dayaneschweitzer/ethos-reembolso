import { REQUESTS_SEED } from './requests.mock';
import { RequestListItem } from '../../models/request.model';
import { COST_CENTERS } from './cost-centers.mock';

const STORAGE_KEY = 'ethos.requests.v0.1';

function nextId(): string {
  const n = Math.floor(Math.random() * 900000 + 100000);
  const year = new Date().getFullYear();
  return `req_${year}_${n}`;
}

function loadFromStorage(): RequestListItem[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    // validação mínima de shape
    return parsed.filter((x: any) => typeof x?.id === 'string' && typeof x?.type === 'string');
  } catch {
    return null;
  }
}

function saveToStorage(data: RequestListItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // se storage estiver indisponível, só ignora
  }
}

export const REQUESTS_DB = (() => {
  const stored = loadFromStorage();
  const data: RequestListItem[] = stored ?? [...REQUESTS_SEED];

  // se não tinha nada salvo ainda, grava o seed
  if (!stored) saveToStorage(data);

  return {
    list: () => [...data],

    addFromMovementPayload: (payload: any) => {
      const total = Number(payload?.grossValue ?? 0);

      const ccCode = String(payload?.costCenterCode ?? '05.001');
      const cc = COST_CENTERS.find(x => x.code === ccCode);

      const dateISO = String(payload?.registerDate ?? new Date().toISOString());
      const ddmmyyyy = new Date(dateISO).toLocaleDateString('pt-BR');

      const item: RequestListItem = {
        id: nextId(),
        type: 'Reembolso',
        costCenter: cc ? cc.name : ccCode, // usa nome quando possível
        date: ddmmyyyy,
        total,
        status: 'Em Aprovação',
      };

      data.unshift(item);
      saveToStorage(data);

      return { ok: true, created: item };
    },

    reset: () => {
      data.splice(0, data.length, ...REQUESTS_SEED);
      saveToStorage(data);
    },
  };
})();
