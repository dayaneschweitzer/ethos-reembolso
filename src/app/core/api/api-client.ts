import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { API } from './api-endpoints';

import { CostCenter } from '../models/cost-center.model';
import { Project } from '../models/project.model';
import { ExpenseType } from '../models/expense.model';
import { RequestListItem } from '../models/request.model';

type AnyRow = Record<string, any>;
type CostCenterRow = { CODCCUSTO: string; NOME: string };

function normalizeRows<T = AnyRow>(resp: any): T[] {
  if (Array.isArray(resp)) return resp as T[];
  if (resp && Array.isArray(resp.value)) return resp.value as T[];
  if (resp && Array.isArray(resp.data)) return resp.data as T[];
  if (resp && Array.isArray(resp.items)) return resp.items as T[];
  return [];
}

function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function toNumber(v: any, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
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

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');

  return s;
}

function inferType(row: AnyRow): 'Reembolso' | 'Adiantamento' {
  const tipo = toStringSafe(
    pick(row, ['TIPO', 'type', 'TIPOSOL', 'TIPOSOLICITACAO']),
    ''
  ).toLowerCase();

  if (tipo.includes('adi')) return 'Adiantamento';
  if (tipo.includes('reemb')) return 'Reembolso';

  const serie = toStringSafe(pick(row, ['SERIE', 'series', 'CODSERIE']), '').toUpperCase();
  if (serie.includes('REEM')) return 'Reembolso';
  if (serie.includes('ADIA')) return 'Adiantamento';

  return 'Reembolso';
}

function inferStatus(row: AnyRow): RequestListItem['status'] {
  const s = toStringSafe(
    pick(row, ['STATUS', 'SITUACAO', 'STATUSDESC', 'status']),
    'Em Aprovação'
  ).toLowerCase();

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
                'ID','IDPROJETO','ID_PROJETO','PROJECTID','PROJETO_ID','IDPRJ',
                'IDPRJPROJETO','CODPROJETO','COD_PROJETO','CODPRJ',
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

  getExpenses(): Observable<ExpenseType[]> {
    return this.http.get<any>(API.expenses()).pipe(
      tap((resp) => console.debug('[ETH.REEM.003] raw:', resp)),
      map((resp) => normalizeRows<AnyRow>(resp)),
      map((rows) =>
        (rows ?? [])
          .map((r, idx) => {
            const idRaw = pick(r, [
              'ID','IDDESPESA','ID_DESPESA','CODDESPESA','COD_DESPESA',
              'CODIGO','COD','CODTB2','CODTBDESP','EXPENSEID',
            ]);

            const id = toNumber(idRaw, idx + 1);

            const name = toStringSafe(
              pick(r, [
                'NOME','NOMEDESPESA','NOME_DESPESA','DESPESA','DESCRICAO','DESCR',
                'DESCRICAODESPESA','DESCRICAO_DESPESA','NAME',
              ]),
              ''
            );

            const taskId = toNumber(
              pick(r, ['TASKID', 'IDTAREFA', 'ID_TAREFA', 'TAREFAID', 'TASK_ID', 'CODTAREFA', 'IDTRF']),
              301
            );

            return { id, name, taskId } as ExpenseType;
          })
          .filter((e) => !!e.name)
      )
    );
  }

  getUserRequests(userCode: string): Observable<RequestListItem[]> {
    const call = (parametersValue: string) => {
      const params = new HttpParams().set('parameters', parametersValue);

      return this.http.get<any>(API.userRequests(), { params }).pipe(
        tap((resp) => console.debug('[ETH.REEM.004] params=', parametersValue, 'raw:', resp)),
        map((resp) => normalizeRows<AnyRow>(resp)),
        catchError((err) => {
          console.error('[ETH.REEM.004] erro com params=', parametersValue, err);
          return of([] as AnyRow[]);
        })
      );
    };

    return call(`USUARIO=${userCode}`).pipe(
      switchMap((rows) => (rows.length ? of(rows) : call(`USUARIO='${userCode}'`))),
      map((rows) =>
        rows.map((r) => {
          const id = toStringSafe(r?.['NUMEROMOV'], toStringSafe(r?.['IDMOV'], '(sem id)'));
          const type = inferType(r);

          const costCenter = toStringSafe(
            r?.['CODCCUSTO'],
            toStringSafe(pick(r, ['NOMECCUSTO', 'CENTRODECUSTO', 'CCUSTO', 'costCenter']), '-')
          );

          const date = toBRDate(r?.['DATAEMISSAO']);
          const total = toNumber(r?.['VALORBRUTOORIG'], 0);
          const status = inferStatus(r);

          return { id, type, costCenter, date, total, status } as RequestListItem;
        })
      )
    );
  }

  saveMovement(payload: unknown): Observable<any> {
    return this.http.post(API.movements(), payload);
  }
}
