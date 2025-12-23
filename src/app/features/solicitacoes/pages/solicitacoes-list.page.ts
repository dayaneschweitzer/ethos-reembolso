import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiClient } from '../../../core/api/api-client';
import { RequestListItem } from '../../../core/models/request.model';
import { environment } from '../../../../environments/environment';
import { formatBRL } from '../../../core/shared/utils/money';
import { from, of } from 'rxjs';
import { catchError, concatMap, finalize, reduce } from 'rxjs/operators';

type FilterType = 'Todos' | 'Reembolso' | 'Adiantamento';
type SortKey = 'id' | 'date';
type SortDir = 'asc' | 'desc';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <h1>Minhas Solicitações</h1>
    <p class="sub">Gerencie seus reembolsos e adiantamentos</p>

    <div class="row" style="justify-content:space-between; margin-bottom:12px;">
      <div style="min-width:260px;">
        <label>Filtrar por tipo</label>
        <select [value]="filter" (change)="onFilter(($any($event.target)).value)">
          <option value="Todos">Todos</option>
          <option value="Reembolso">Reembolso</option>
          <option value="Adiantamento">Adiantamento</option>
        </select>
      </div>

      <div class="row" style="gap:8px; align-items:flex-end;">
        <button type="button" (click)="reload()" [disabled]="loading">Atualizar</button>
        <a routerLink="/reembolso/novo"><button class="primary">+ Reembolso</button></a>
      </div>
    </div>

    <div class="card">
      <div class="small" style="margin-bottom:10px; color:#b91c1c;" *ngIf="errorMsg">
        {{ errorMsg }}
      </div>

      <table class="table" *ngIf="!loading; else loadingTpl">
        <thead>
          <tr>
            <th>
              <button
                type="button"
                class="thbtn"
                (click)="toggleSort('id')"
                [attr.aria-sort]="ariaSort('id')"
                title="Ordenar por número"
              >
                Nº <span class="sort-ind">{{ sortIndicator('id') }}</span>
              </button>
            </th>

            <th>Tipo</th>
            <th>Centro de Custo</th>

            <th>
              <button
                type="button"
                class="thbtn"
                (click)="toggleSort('date')"
                [attr.aria-sort]="ariaSort('date')"
                title="Ordenar por data"
              >
                Data <span class="sort-ind">{{ sortIndicator('date') }}</span>
              </button>
            </th>

            <th>Total</th>
            <th>Status</th>
            <th style="text-align:right;">Ações</th>
          </tr>
        </thead>

        <tbody>
          <tr *ngFor="let r of filteredItems; trackBy: trackById">
            <td style="color: var(--primary); font-weight: 700;">{{ r.id }}</td>
            <td>{{ r.type }}</td>
            <td>{{ r.costCenter }}</td>
            <td>{{ r.date }}</td>
            <td>{{ brl(r.total) }}</td>
            <td>
              <span class="badge" [ngClass]="statusClass(r.status)">{{ r.status }}</span>
            </td>
            <td style="text-align:right;">
              <button type="button" class="link" (click)="view(r)">ver</button>
            </td>
          </tr>

          <tr *ngIf="filteredItems.length === 0">
            <td colspan="7" class="small" style="padding:16px;">Nenhuma solicitação encontrada.</td>
          </tr>
        </tbody>
      </table>

      <ng-template #loadingTpl>
        <div class="small">Carregando solicitações...</div>
      </ng-template>
    </div>

    <div class="card" style="margin-top:12px;" *ngIf="selected">
      <h2>Detalhe</h2>
      <div class="small">ID: <strong>{{ selected.id }}</strong></div>
      <div class="small">Tipo: <strong>{{ selected.type }}</strong></div>
      <div class="small">Centro de custo: <strong>{{ selected.costCenter }}</strong></div>
      <div class="small">Data: <strong>{{ selected.date }}</strong></div>
      <div class="small">Total: <strong>{{ brl(selected.total) }}</strong></div>
      <div class="small">Status: <strong>{{ selected.status }}</strong></div>

      <div class="actions">
        <button type="button" (click)="selected = null">Fechar</button>
      </div>
    </div>

    <style>
      .thbtn {
        border: 0;
        background: transparent;
        padding: 0;
        font: inherit;
        color: inherit;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .thbtn:hover { text-decoration: underline; }
      .sort-ind { font-size: 12px; opacity: 0.8; }
    </style>
  `,
})
export class SolicitacoesListPage implements OnInit {
  loading = true;
  errorMsg = '';

  items: RequestListItem[] = [];
  filteredItems: RequestListItem[] = [];

  selected: RequestListItem | null = null;
  filter: FilterType = 'Todos';

  // Ordenação
  sortKey: SortKey = 'date';
  sortDir: SortDir = 'desc';

  private readonly pageSize = 50;
  private readonly maxPagesToScan = 6;

  constructor(private api: ApiClient) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.errorMsg = '';
    this.selected = null;

    const code = environment.defaultUserCode;
    const pages = Array.from({ length: this.maxPagesToScan }, (_, i) => i + 1);

    from(pages)
      .pipe(
        // mantendo a estratégia atual, sem paginação na API
        concatMap(() =>
          this.api.getUserRequests(code).pipe(
            catchError((err) => {
              console.error('[getUserRequests] erro', err);
              return of([] as RequestListItem[]);
            })
          )
        ),
        reduce((acc, curr) => acc.concat(curr), [] as RequestListItem[]),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: (all) => {
          // remove duplicados
          const uniq = new Map<string, RequestListItem>();
          for (const it of all) uniq.set(String(it.id), it);

          this.items = Array.from(uniq.values());
          this.applyFilter(); // aplica filtro + ordenação
        },
        error: (err) => {
          console.error('[getUserRequests] erro geral', err);
          this.items = [];
          this.filteredItems = [];
          this.errorMsg =
            'Falha ao carregar solicitações. Verifique o console (Network) para ver o status HTTP (401/404/CORS).';
        },
      });
  }

  onFilter(v: FilterType) {
    this.filter = v;
    this.applyFilter();
  }

  toggleSort(key: SortKey) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      // padrão: data DESC, número DESC (você pode mudar aqui se quiser)
      this.sortDir = key === 'date' ? 'desc' : 'desc';
    }
    this.applySort();
  }

  sortIndicator(key: SortKey): string {
    if (this.sortKey !== key) return '';
    return this.sortDir === 'asc' ? '▲' : '▼';
  }

  ariaSort(key: SortKey): 'none' | 'ascending' | 'descending' {
    if (this.sortKey !== key) return 'none';
    return this.sortDir === 'asc' ? 'ascending' : 'descending';
  }

  private applyFilter(): void {
    const base =
      this.filter === 'Todos'
        ? this.items
        : this.items.filter((x) => x.type === this.filter);

    this.filteredItems = [...base];
    this.applySort();
  }

  private applySort(): void {
    const dir = this.sortDir === 'asc' ? 1 : -1;

    this.filteredItems = [...this.filteredItems].sort((a, b) => {
      if (this.sortKey === 'date') {
        const da = this.parseBRorISODate(a.date);
        const db = this.parseBRorISODate(b.date);
        if (da && db) return (da.getTime() - db.getTime()) * dir;
        if (da && !db) return 1 * dir;
        if (!da && db) return -1 * dir;
        // fallback por número
        return this.compareId(a.id, b.id) * dir;
      }

      // sortKey === 'id'
      return this.compareId(a.id, b.id) * dir;
    });
  }

  private compareId(a: any, b: any): number {
    const sa = String(a ?? '').trim();
    const sb = String(b ?? '').trim();

    const na = Number(sa);
    const nb = Number(sb);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;

    return sa.localeCompare(sb);
  }

  brl(v: number) {
    return formatBRL(v);
  }

  view(r: RequestListItem) {
    this.selected = r;
  }

  statusClass(status: RequestListItem['status']): string {
    switch (status) {
      case 'Pago':
        return 'badge--success';
      case 'Aprovado':
        return 'badge--info';
      case 'Em Aprovação':
      default:
        return 'badge--warn';
    }
  }

  trackById(_: number, r: RequestListItem) {
    return r.id;
  }

  private parseBRorISODate(s: string): Date | null {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '').trim());
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]);
      const yyyy = Number(m[3]);
      const d = new Date(yyyy, mm - 1, dd);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
}
