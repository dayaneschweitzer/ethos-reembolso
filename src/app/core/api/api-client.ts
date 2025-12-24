import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, tap, catchError, of, from } from 'rxjs';
import { concatMap, reduce } from 'rxjs/operators';
import { API } from './api-endpoints';

import { CostCenter } from '../models/cost-center.model';
import { Project } from '../models/project.model';
import { ExpenseType } from '../models/expense.model';
import { Task } from '../models/task.model';
import { RequestListItem } from '../models/request.model';

type AnyRow = Record<string, any>;
type CostCenterRow = { CODCCUSTO: string; NOME: string };

function normalizeRows<T = AnyRow>(resp: any): T[] {
  if (Array.isArray(resp)) return resp as T[];
  if (resp && Array.isArray(resp.value)) return resp.value as T[];
  if (resp && Array.isArray(resp.data)) return resp.data as T[];
  if (resp && Array.isArray(resp.items)) return resp.items as T[];
  // Alguns endpoints do RM/consultas SQL retornam outros nomes para o array.
  if (resp && Array.isArray(resp.result)) return resp.result as T[];
  if (resp && Array.isArray(resp.results)) return resp.results as T[];
  if (resp && Array.isArray(resp.rows)) return resp.rows as T[];
  if (resp && Array.isArray(resp.retorno)) return resp.retorno as T[];
  if (resp && Array.isArray(resp.return)) return resp.return as T[];

  // Fallback: se existir exatamente um campo-array no objeto, usa ele.
  if (resp && typeof resp === 'object') {
    const values = Object.values(resp);
    const arrays = values.filter((v) => Array.isArray(v)) as any[];
    if (arrays.length === 1) return arrays[0] as T[];
  }
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
  // A consulta ETH.REEM.005 deve retornar as tarefas (MTAREFA) filtradas por IDPRJ.
  // Se seu RM usa outro nome de parâmetro, ajuste aqui.
  const params = new HttpParams().set('parameters', `IDPRJ=${projectId}`);

  return this.http.get<any>(API.tasksByProject(), { params }).pipe(
    tap((resp) => console.debug('[ETH.REEM.005] raw:', resp)),
    map((resp) => normalizeRows<AnyRow>(resp)),
    map((rows) =>
      (rows ?? [])
        .map((r) => {
          const id = toNumber(
            pick(r, ['IDTRF', 'IDTAREFA', 'ID_TAREFA', 'TASKID', 'TASK_ID', 'ID']),
            0
          );

          const name = toStringSafe(
            pick(r, ['NOME', 'NOMETAREFA', 'NOME_TAREFA', 'DESCRICAO', 'DESCR', 'TAREFA', 'NAME']),
            ''
          );

          const pid = toNumber(
            pick(r, ['IDPRJ', 'IDPROJETO', 'ID_PROJETO', 'PROJECTID', 'PROJECT_ID']),
            projectId
          );

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

            const taskIdMaybe = toNumber(
  pick(r, ['TASKID', 'IDTAREFA', 'ID_TAREFA', 'TAREFAID', 'TASK_ID', 'CODTAREFA', 'IDTRF']),
  0
);

// Importante: não "chute" uma tarefa padrão (ex.: 301). Se não vier do RM, o usuário precisa selecionar uma tarefa válida para o projeto.
const taskId = taskIdMaybe > 0 ? taskIdMaybe : undefined;

return { id, name, taskId } as ExpenseType;
          })
          .filter((e) => !!e.name)
      )
    );
  }

  getUserRequests(userCode: string): Observable<RequestListItem[]> {
    // A consulta ETH.REEM.004 foi criada no RM/TOTVS e pode usar diferentes nomes de parâmetros
    // (ex.: USUARIO, CODUSUARIO, CODCFO). Como o frontend não tem acesso ao SQL, fazemos tentativas
    // com variações comuns para maximizar a chance de retorno.
    const raw = String(userCode ?? '').trim();

    const attempts: string[] = [];
    if (raw) {
      // variações com/sem aspas
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

        const date = toBRDate(pick(r, ['DATA', 'DTEMISSAO', 'DT_EMISSAO', 'DATE', 'registerDate', 'CREATIONDATE']));

        const total = toNumber(pick(r, ['TOTAL', 'VALOR', 'VLR', 'VLRTOTAL', 'GROSSVALUE', 'NETVALUE', 'netValue']), 0);

        const status = inferStatus(r);

        return { id, type, costCenter, date, total, status } as RequestListItem;
      });

    // Se por algum motivo a consulta não aceitar nenhum parâmetro, tenta uma chamada "nua" também.
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
        // merge + dedup por id
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
}
