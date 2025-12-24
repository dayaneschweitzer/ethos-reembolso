import { RequestListItem } from '../models/request.model';

const KEY = 'ethos.localRequests.v0.1';
const MAX_ITEMS = 50;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; 

type Stored = { createdAt: number; item: RequestListItem };

function load(): Stored[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function save(list: Stored[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function cleanup(list: Stored[]): Stored[] {
  const now = Date.now();
  const cleaned = list
    .filter((x) => x?.item && typeof x.createdAt === 'number')
    .filter((x) => now - x.createdAt <= MAX_AGE_MS)
    .slice(0, MAX_ITEMS);
  return cleaned;
}

export function addLocalRequest(item: RequestListItem): void {
  const list = cleanup(load());
  list.unshift({ createdAt: Date.now(), item });
  save(list);
}

export function getLocalRequests(): RequestListItem[] {
  return cleanup(load()).map((x) => x.item);
}

export function clearLocalRequests(): void {
  localStorage.removeItem(KEY);
}
