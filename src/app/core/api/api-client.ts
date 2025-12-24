import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap, catchError, of, from, concat } from 'rxjs';
import { concatMap, reduce, filter, take, defaultIfEmpty, mergeMap, toArray } from 'rxjs/operators';
import { API } from './api-endpoints';

import { CostCenter } from '../models/cost-center.model';
import { Project } from '../models/project.model';
import { ExpenseType } from '../models/expense.model';
import { Task } from '../models/task.model';
import { RequestListItem } from '../models/request.model';

type AnyRow = Record<string, any>;
type CostCenterRow = { CODCCUSTO: string; NOME: string };

function normalizeKey(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeRows<T = AnyRow>(resp: any): T[] {
  if (Array.isArray(resp)) return resp as T[];
  if (resp && Array.isArray(resp.value)) return resp.value as T[];
  if (resp && Array.isArray(resp.data)) return resp.data as T[];
  if (resp && Array.isArray(resp.items)) return resp.items as T[];
  if (resp && Array.isArray(resp.result)) return resp.result as T[];
  if (resp && Array.isArray(resp.results)) return resp.results as T[];
  if (resp && Array.isArray(resp.rows)) return resp.rows as T[];
  if (resp && Array.isArray(resp.retorno)) return resp.retorno as T[];
  if (resp && Array.isArray(resp.return)) return resp.return as T[];

  if (resp && typeof resp === 'object') {
    const values = Object.values(resp);
    const arrays = values.filter((v) => Array.isArray(v)) as any[];
    if (arrays.length === 1) return arrays[0] as T[];
  }

  return [];
}

function pick(obj: any, keys: string[]) {
  if (!obj || typeof obj !== 'object') return undefined;

  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }

  const entries = Object.entries(obj);
  for (const k of keys) {
    const nk = normalizeKey(k);
    for (const [ok, ov] of entries) {
      if (normalizeKey(ok) === nk && ov !== undefined && ov !== null && ov !== '') return ov;
    }
  }

  return undefined;
}

function toNumber(v: any, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (v === undefined || v === null) return fallback;

  let s = String(v).trim();
  if (!s) return fallback;

  s = s.replace(/[R$\s]/g, '');
  s = s.replace(/[a-zA-Z]/g, '');
  s = s.replace(/[^0-9,.-]/g, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    s = s.replace(',', '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function toStringSafe(v: any, fallback = ''): string {
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  return s ? s : fallback;
}

function toBRDate(value: any): string {
  const s = toStringSafe(value, '');
  if (!s) return '-';

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (m) return `${m[1]}/${m[2]}/${m[3]}`;

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');

  return s;
}

function inferType(row: AnyRow): 'Reembolso' | 'Adiantamento' {
  const tipo = toStringSafe(pick(row, ['TIPO', 'type', 'TIPOSOL', 'TIPOSOLICITACAO']), '').toLowerCase();
  if (tipo.includes('adi')) return 'Adiantamento';
  if (tipo.includes('reemb')) return 'Reembolso';

  const serie = toStringSafe(pick(row, ['SERIE', 'series', 'CODSERIE']), '').toUpperCase();
  if (serie.includes('REEM')) return 'Reembolso';
  if (serie.includes('ADIA')) return 'Adiantamento';

  return 'Reembolso';
}

function inferStatus(row: AnyRow): RequestListItem['status'] {
  const s = toStringSafe(pick(row, ['STATUS', 'SITUACAO', 'STATUSDESC', 'status']), 'Em Aprovação').toLowerCase();
  if (s.includes('pago') || s.includes('quit')) return 'Pago';
  if (s.includes('aprov')) return 'Aprovado';
  return 'Em Aprovação';
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  constructor(private http: HttpClient) {}

  getCostCenters(): Observable<CostCenter[]> {
    return this.http.get<CostCenterRow[] | any>(API.costCenters()).pipe(
      map((resp) => normalizeRows<CostCenterRow>(resp)),
      map((rows) => rows.map((r) => ({ code: r.CODCCUSTO, name: r.NOME })))
    );
  }

  getProjects(): Observable<Project[]> {
    return this.http.get<any>(API.projects()).pipe(
      tap((resp) => console.debug('[ETH.REEM.002] raw:', resp)),
      map((resp) => normalizeRows<AnyRow>(resp)),
      map((rows) =>
        rows
          .map((r) => {
            const id = toNumber(
              pick(r, [
                'ID',
                'IDPROJETO',
                'ID_PROJETO',
                'PROJECTID',
                'PROJETO_ID',
                'IDPRJ',
                'IDPRJPROJETO',
                'CODPROJETO',
                'COD_PROJETO',
                'CODPRJ',
              ]),
              0
            );

            const name = toStringSafe(
              pick(r, ['NOME', 'NOMEPROJETO', 'NOME_PROJETO', 'DESCRICAO', 'DESCR', 'PROJETO', 'NAME']),
              ''
            );

            return { id, name } as Project;
          })
          .filter((p) => p.id > 0 && !!p.name)
      )
    );
  }

  getTasksByProject(projectId: number): Observable<Task[]> {
    const params = new HttpParams().set('parameters', `IDPRJ=${projectId}`);

    return this.http.get<any>(API.tasksByProject(), { params }).pipe(
      tap((resp) => console.debug('[ETH.REEM.005] raw:', resp)),
      map((resp) => normalizeRows<AnyRow>(resp)),
      map((rows) =>
        (rows ?? [])
          .map((r) => {
            const id = toNumber(pick(r, ['IDTRF', 'IDTAREFA', 'ID_TAREFA', 'TASKID', 'TASK_ID', 'ID']), 0);

            const name = toStringSafe(
              pick(r, ['NOME', 'NOMETAREFA', 'NOME_TAREFA', 'DESCRICAO', 'DESCR', 'TAREFA', 'NAME']),
              ''
            );

            const pid = toNumber(pick(r, ['IDPRJ', 'IDPROJETO', 'ID_PROJETO', 'PROJECTID', 'PROJECT_ID']), projectId);

            return { id, name, projectId: pid } as Task;
          })
          .filter((t) => t.id > 0 && !!t.name)
      ),
      catchError((err) => {
        console.warn('[ETH.REEM.005] falha ao carregar tarefas:', err);
        return of([] as Task[]);
      })
    );
  }

  getExpenses(): Observable<ExpenseType[]> {
    return this.http.get<any>(API.expenses()).pipe(
      tap((resp) => console.debug('[ETH.REEM.003] raw:', resp)),
      map((resp) => normalizeRows<AnyRow>(resp)),
      map((rows) =>
        (rows ?? [])
          .map((r, idx) => {
            const idRaw = pick(r, [
              'ID',
              'IDDESPESA',
              'ID_DESPESA',
              'CODDESPESA',
              'COD_DESPESA',
              'CODIGO',
              'COD',
              'CODTB2',
              'CODTBDESP',
              'EXPENSEID',
            ]);

            const id = toNumber(idRaw, idx + 1);

            const name = toStringSafe(
              pick(r, [
                'NOME',
                'NOMEDESPESA',
                'NOME_DESPESA',
                'DESPESA',
                'DESCRICAO',
                'DESCR',
                'DESCRICAODESPESA',
                'DESCRICAO_DESPESA',
                'NAME',
              ]),
              ''
            );

            // Importante: não "chutar" tarefa padrão.
            const taskIdMaybe = toNumber(
              pick(r, ['TASKID', 'IDTAREFA', 'ID_TAREFA', 'TAREFAID', 'TASK_ID', 'CODTAREFA', 'IDTRF']),
              0
            );
            const taskId = taskIdMaybe > 0 ? taskIdMaybe : undefined;

            return { id, name, taskId } as ExpenseType;
          })
          .filter((e) => !!e.name)
      )
    );
  }

  getUserRequests(userCode: string): Observable<RequestListItem[]> {
    const raw = String(userCode ?? '').trim();

    const attempts: string[] = [];
    if (raw) {
      attempts.push(`USUARIO='${raw}'`, `USUARIO=${raw}`);
      attempts.push(`CODUSUARIO='${raw}'`, `CODUSUARIO=${raw}`);
      attempts.push(`CODCFO='${raw}'`, `CODCFO=${raw}`);
      attempts.push(`CFO='${raw}'`, `CFO=${raw}`);
      attempts.push(`CLIENTE='${raw}'`, `CLIENTE=${raw}`);
      attempts.push(`FORNECEDOR='${raw}'`, `FORNECEDOR=${raw}`);
    }

    const mapRowsToList = (rows: AnyRow[]) =>
      rows.map((r) => {
        const id = toStringSafe(
          pick(r, ['ID', 'REQ', 'REQUISICAO', 'NUMERO', 'NUMMOV', 'IDMOV', 'CODMOV', 'DOCUMENTO']),
          '(sem id)'
        );

        const type = inferType(r);

        const costCenter = toStringSafe(
          pick(r, ['NOMECCUSTO', 'CENTRODECUSTO', 'CCUSTO', 'CODCCUSTO', 'CUSTOCENTER', 'costCenter']),
          '-'
        );

        const date = toBRDate(
          pick(r, [
            'DATA',
            'DATAMOV',
            'DATAMOVIMENTO',
            'DTMOV',
            'DTMOVIMENTO',
            'DTEMISSAO',
            'DT_EMISSAO',
            'DTLANC',
            'DTLANCAMENTO',
            'DATE',
            'registerDate',
            'creationDate',
            'date',
            'extraDate1',
            'registerTime',
            'lastEditTime',
          ])
        );

        let total = toNumber(
          pick(r, [
            'TOTAL',
            'VALOR',
            'VLR',
            'VLRTOTAL',
            'VLR_TOTAL',
            'VALORTOTAL',
            'VALOR_TOTAL',
            'VLRLIQUIDO',
            'VLR_LIQUIDO',
            'VALORLIQUIDO',
            'VALOR_LIQUIDO',
            'VLRBRUTO',
            'VLR_BRUTO',
            'GROSSVALUE',
            'grossValue',
            'NETVALUE',
            'netValue',
            'OTHERVALUES',
            'otherValues',
          ]),
          0
        );

        const status = inferStatus(r);

        return { id, type, costCenter, date, total, status } as RequestListItem;
      });

    const attemptsWithEmpty = attempts.length ? [...attempts, ''] : [''];

    return from(attemptsWithEmpty).pipe(
      concatMap((expr) => {
        const params = expr ? new HttpParams().set('parameters', expr) : undefined;
        return this.http.get<any>(API.userRequests(), params ? { params } : {}).pipe(
          tap((resp) => console.debug('[ETH.REEM.004] tentativa:', expr || '(sem parameters)', 'raw:', resp)),
          map((resp) => normalizeRows<AnyRow>(resp)),
          map((rows) => mapRowsToList(rows)),
          catchError((err) => {
            console.warn('[ETH.REEM.004] tentativa falhou:', expr || '(sem parameters)', err);
            return of([] as RequestListItem[]);
          })
        );
      }),
      reduce((acc, curr) => {
        const m = new Map<string, RequestListItem>();
        for (const it of acc) m.set(String(it.id), it);
        for (const it of curr) m.set(String(it.id), it);
        return Array.from(m.values());
      }, [] as RequestListItem[])
    );
  }

  createMovement(payload: unknown): Observable<any> {
    return this.http.post(API.movements(), payload);
  }

  saveMovement(payload: unknown): Observable<any> {
    return this.createMovement(payload);
  }

  // ---------------------------
  // ✅ HIDRATAÇÃO VIA MOVEMENTS
  // ---------------------------

  private extractFirstMovement(resp: any): any | null {
    if (!resp) return null;

    if (resp.movementId !== undefined || resp.internalId !== undefined) return resp;

    if (Array.isArray(resp)) return resp[0] ?? null;

    const arr =
      resp.value ??
      resp.items ??
      resp.data ??
      resp.result ??
      resp.results ??
      resp.rows;

    if (Array.isArray(arr)) return arr[0] ?? null;

    return null;
  }

  getMovementSummary(companyId: number, movementId: string | number): Observable<Partial<RequestListItem>> {
    const rawId = String(movementId ?? '').trim();
    if (!rawId) return of({});

    let movId = rawId;
    let internalId = `${companyId}|${rawId}`;

    // Se já vier internalId no formato "1|18151"
    if (rawId.includes('|')) {
      internalId = rawId;
      const parts = rawId.split('|');
      if (parts.length >= 2) movId = parts[1];
    }

    const base = API.movements();

    const try1 = `${base}/${encodeURIComponent(internalId)}`;
    const try2 = `${base}/${encodeURIComponent(movId)}`;

    const p3 = new HttpParams()
      .set('$filter', `companyId eq ${companyId} and movementId eq ${movId}`)
      .set('$top', '1');

    const p4 = new HttpParams()
      .set('$filter', `movementId eq ${movId}`)
      .set('$top', '1');

    return concat(
      this.http.get<any>(try1).pipe(catchError(() => of(null))),
      this.http.get<any>(try2).pipe(catchError(() => of(null))),
      this.http.get<any>(base, { params: p3 }).pipe(catchError(() => of(null))),
      this.http.get<any>(base, { params: p4 }).pipe(catchError(() => of(null)))
    ).pipe(
      map((resp) => this.extractFirstMovement(resp)),
      filter((m) => !!m),
      take(1),
      map((m: any) => {
        const dateRaw = m.registerDate ?? m.date ?? m.extraDate1 ?? m.creationDate ?? m.lastEditTime;
        const totalRaw = m.grossValue ?? m.netValue ?? m.otherValues ?? m.internalGrossValue ?? 0;

        const ccFromHeader = m.costCenterApportionments?.[0]?.costCenterCode ?? null;
        const ccFromItem = m.movementItems?.[0]?.costCenterApportionments?.[0]?.costCenterCode ?? null;

        return {
          date: toBRDate(dateRaw),
          total: toNumber(totalRaw, 0),
          costCenter: ccFromHeader ?? ccFromItem ?? undefined,
        } as Partial<RequestListItem>;
      }),
      defaultIfEmpty({}),
      catchError(() => of({}))
    );
  }

  hydrateRequestList(items: RequestListItem[], companyId: number, concurrency = 5): Observable<RequestListItem[]> {
    const base = items ?? [];
    const need = base.filter((i) => i.date === '-' || !i.date || i.total === 0 || i.costCenter === '-');

    if (!need.length) return of(base);

    return from(need).pipe(
      mergeMap(
        (it) =>
          this.getMovementSummary(companyId, it.id).pipe(
            map((sum) => {
              const next: RequestListItem = { ...it };

              if ((next.date === '-' || !next.date) && sum.date && sum.date !== '-') next.date = sum.date;
              if (next.total === 0 && typeof sum.total === 'number') next.total = sum.total;

              if ((next.costCenter === '-' || !next.costCenter) && sum.costCenter) {
                next.costCenter = String(sum.costCenter);
              }

              return next;
            }),
            catchError(() => of(it))
          ),
        concurrency
      ),
      toArray(),
      map((hydrated) => {
        const mapById = new Map<string, RequestListItem>();
        for (const h of hydrated) mapById.set(String(h.id), h);
        return base.map((it) => mapById.get(String(it.id)) ?? it);
      }),
      catchError(() => of(base))
    );
  }
}
