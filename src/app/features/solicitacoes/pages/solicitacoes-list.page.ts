import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiClient } from '../../../core/api/api-client';
import { RequestListItem } from '../../../core/models/request.model';
import { environment } from '../../../../environments/environment';
import { formatBRL } from '../../../core/shared/utils/money';

type FilterType = 'Todos' | 'Reembolso' | 'Adiantamento';

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
        <a routerLink="/reembolso/novo"><button class="primary">+ Reembolso</button></a>
      </div>
    </div>

    <div class="card">
      <table class="table" *ngIf="!loading; else loadingTpl">
        <thead>
          <tr>
            <th>Nº</th>
            <th>Tipo</th>
            <th>Centro de Custo</th>
            <th>Data</th>
            <th>Total</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of filtered()">
            <td style="color: var(--primary); font-weight: 700;">{{ r.id }}</td>
            <td>{{ r.type }}</td>
            <td>{{ r.costCenter }}</td>
            <td>{{ r.date }}</td>
            <td>{{ brl(r.total) }}</td>
            <td><span class="badge">{{ r.status }}</span></td>
            <td><button class="link" (click)="view(r)">ver</button></td>
          </tr>
          <tr *ngIf="filtered().length === 0">
            <td colspan="7" class="small" style="padding:16px;">Nenhuma solicitação encontrada.</td>
          </tr>
        </tbody>
      </table>

      <ng-template #loadingTpl>
        <div class="small">Carregando solicitações...</div>
      </ng-template>
    </div>

    <div class="card" style="margin-top:12px;" *ngIf="selected">
      <h2>Detalhe (mock)</h2>
      <div class="small">ID: <strong>{{ selected.id }}</strong></div>
      <div class="small">Tipo: <strong>{{ selected.type }}</strong></div>
      <div class="small">Centro de custo: <strong>{{ selected.costCenter }}</strong></div>
      <div class="small">Total: <strong>{{ brl(selected.total) }}</strong></div>
      <div class="actions"><button (click)="selected = null">Fechar</button></div>
    </div>
  `,
})
export class SolicitacoesListPage implements OnInit {
  loading = true;
  items: RequestListItem[] = [];
  selected: RequestListItem | null = null;
  filter: FilterType = 'Todos';

  constructor(private api: ApiClient) {}

  ngOnInit(): void {
    this.api.getUserRequests(environment.defaultUserCode).subscribe({
      next: (data) => {
        this.items = data;
        this.loading = false;
      },
      error: () => {
        this.items = [];
        this.loading = false;
      },
    });
  }

  onFilter(v: FilterType) {
    this.filter = v;
  }

  filtered(): RequestListItem[] {
    if (this.filter === 'Todos') return this.items;
    return this.items.filter((x) => x.type === this.filter);
  }

  brl(v: number) {
    return formatBRL(v);
  }

  view(r: RequestListItem) {
    this.selected = r;
  }
}
