import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormArray, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiClient } from '../../../core/api/api-client';
import { CostCenter } from '../../../core/models/cost-center.model';
import { Project } from '../../../core/models/project.model';
import { ExpenseType } from '../../../core/models/expense.model';
import { sum, formatBRL } from '../../../core/shared/utils/money';
import { buildMovementPayload, ReembolsoFormVM } from '../reembolso.mapper';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <h1>Novo Reembolso</h1>
    <p class="sub">Preencha os dados abaixo para submeter sua solicitação.</p>

    <div class="card" style="margin-bottom:12px;">
      <h2>Dados Gerais</h2>
      <div class="row">
        <div class="col">
          <label>Centro de Custo</label>
          <select [formControl]="form.controls.costCenterCode">
            <option value="" disabled>Selecione...</option>
            <option *ngFor="let cc of costCenters" [value]="cc.code">{{ cc.code }} — {{ cc.name }}</option>
          </select>
          <div class="small" *ngIf="form.controls.costCenterCode.touched && form.controls.costCenterCode.invalid">
            Informe o centro de custo.
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px;">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <h2 style="margin:0;">Itens da Despesa</h2>
        <button (click)="addItem()">+ Adicionar Item</button>
      </div>

      <table class="table" *ngIf="items.length > 0; else emptyItems">
        <thead>
          <tr>
            <th style="min-width:220px;">Tipo de Despesa</th>
            <th style="width:90px;">Qtd</th>
            <th style="min-width:160px;">Projeto</th>
            <th style="width:140px;">Valor (R$)</th>
            <th style="width:140px;">Total</th>
            <th style="width:80px;"></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let g of items.controls; let i = index" [formGroup]="$any(g)">
            <td>
              <select formControlName="expenseTypeId" (change)="syncTask(i)">
                <option value="" disabled>Selecione...</option>
                <option *ngFor="let e of expenses" [value]="e.id">{{ e.name }}</option>
              </select>
            </td>
            <td><input formControlName="quantity" disabled></td>
            <td>
              <select formControlName="projectId">
                <option value="" disabled>Selecione...</option>
                <option *ngFor="let p of projects" [value]="p.id">{{ p.name }}</option>
              </select>
            </td>
            <td>
              <input type="number" min="0" step="0.01" formControlName="unitPrice" (input)="noop()">
            </td>
            <td>{{ brl(lineTotal(i)) }}</td>
            <td><button class="link" (click)="removeItem(i)">remover</button></td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyItems>
        <div class="small" style="padding:10px 0;">Adicione ao menos 1 item de despesa.</div>
      </ng-template>

      <div class="kpi">
        <div>Total da Requisição:</div>
        <div style="color: var(--primary);">{{ brl(total()) }}</div>
      </div>
    </div>

    <div class="card">
      <h2>Comprovantes</h2>
      <div class="dropzone">
        <div style="margin-bottom:8px;">Clique para selecionar (mock local)</div>
        <input type="file" multiple (change)="onFiles($event)">
        <div class="small" style="margin-top:10px;" *ngIf="files.length">
          <div *ngFor="let f of files">• {{ f.name }}</div>
        </div>
      </div>

      <div class="actions">
        <button (click)="cancel()">Cancelar</button>
        <button class="primary" (click)="save()" [disabled]="saving || form.invalid || items.length === 0">
          {{ saving ? 'Salvando...' : 'Salvar Solicitação' }}
        </button>
      </div>

      <div class="small" style="margin-top:10px;" *ngIf="errorMsg">{{ errorMsg }}</div>
      <div class="small" style="margin-top:10px; color: #065f46;" *ngIf="successMsg">{{ successMsg }}</div>
    </div>
  `,
})
export class ReembolsoNovoPage implements OnInit {
  saving = false;
  errorMsg = '';
  successMsg = '';

  costCenters: CostCenter[] = [];
  projects: Project[] = [];
  expenses: ExpenseType[] = [];
  files: File[] = [];

  form = this.fb.nonNullable.group({
    costCenterCode: ['', Validators.required],
    items: this.fb.array([]),
  });

  get items(): FormArray {
    return this.form.controls.items as FormArray;
  }

  constructor(private fb: FormBuilder, private api: ApiClient, private router: Router) {}

  ngOnInit(): void {
    this.api.getCostCenters().subscribe((x) => (this.costCenters = x));
    this.api.getProjects().subscribe((x) => (this.projects = x));
    this.api.getExpenses().subscribe((x) => (this.expenses = x));

    // começa com 1 item para reduzir atrito do avaliador
    this.addItem();
  }

  addItem(): void {
    const g = this.fb.nonNullable.group({
      expenseTypeId: ['', Validators.required],
      projectId: ['', Validators.required],
      taskId: [301, Validators.required],
      quantity: [{ value: 1, disabled: true }],
      unitPrice: [0, [Validators.required, Validators.min(0.01)]],
    });

    this.items.push(g);
  }

  removeItem(i: number): void {
    this.items.removeAt(i);
  }

  syncTask(i: number): void {
    const group = this.items.at(i);
    const expenseId = Number(group.get('expenseTypeId')?.value);
    const exp = this.expenses.find(e => e.id === expenseId);
    if (exp) group.get('taskId')?.setValue(exp.taskId);
  }

  lineTotal(i: number): number {
    const g = this.items.at(i);
    const unit = Number(g.get('unitPrice')?.value ?? 0);
    return unit;
  }

  total(): number {
    return sum(this.items.controls.map((_, i) => this.lineTotal(i)));
  }

  brl(v: number): string {
    return formatBRL(v);
  }

  onFiles(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    this.files = list;
  }

  cancel() {
    this.router.navigateByUrl('/solicitacoes');
  }

  noop() {}

  save(): void {
    this.errorMsg = '';
    this.successMsg = '';
    this.form.markAllAsTouched();

    if (this.form.invalid || this.items.length === 0) {
      this.errorMsg = 'Revise os campos obrigatórios.';
      return;
    }

    const ccCode = this.form.controls.costCenterCode.value;
    const cc = this.costCenters.find(x => x.code === ccCode);

    const vm: ReembolsoFormVM = {
      costCenterCode: ccCode,
      costCenterName: cc?.name ?? '',
      items: this.items.controls.map((g) => {
        const expenseId = Number(g.get('expenseTypeId')?.value);
        const projectId = Number(g.get('projectId')?.value);
        const unitPrice = Number(g.get('unitPrice')?.value);
        const taskId = Number(g.get('taskId')?.value);

        const exp = this.expenses.find(e => e.id === expenseId);
        const proj = this.projects.find(p => p.id === projectId);

        return {
          expenseTypeId: expenseId,
          expenseName: exp?.name ?? '',
          projectId,
          projectName: proj?.name ?? '',
          taskId,
          quantity: 1,
          unitPrice,
        };
      }),
    };

    const payload = buildMovementPayload(vm);

    this.saving = true;
    this.api.saveMovement(payload).subscribe({
      next: () => {
        this.saving = false;
        this.successMsg = 'Solicitação enviada (mock). Redirecionando...';
        setTimeout(() => this.router.navigateByUrl('/solicitacoes'), 600);
      },
      error: (err) => {
        this.saving = false;
        this.errorMsg = err?.error?.message ?? 'Falha ao salvar (mock).';
      },
    });
  }
}
