import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormArray, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ApiClient } from '../../../core/api/api-client';
import { CostCenter } from '../../../core/models/cost-center.model';
import { Project } from '../../../core/models/project.model';
import { ExpenseType } from '../../../core/models/expense.model';
import { Task } from '../../../core/models/task.model';
import { sum, formatBRL } from '../../../core/shared/utils/money';
import { buildMovementPayload, ReembolsoFormVM } from '../reembolso.mapper';

import { addLocalRequest } from '../../../core/shared/local-requests';

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
            <option *ngFor="let cc of costCenters" [value]="cc.code">
              {{ cc.code }} — {{ cc.name }}
            </option>
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
        <button type="button" (click)="addItem()">+ Adicionar Item</button>
      </div>

      <table class="table" *ngIf="items.length > 0; else emptyItems">
        <thead>
          <tr>
            <th style="min-width:220px;">Tipo de Despesa</th>
            <th style="width:90px;">Qtd</th>
            <th style="min-width:180px;">Projeto</th>
            <th style="min-width:220px;">Tarefa</th>
            <th style="width:160px;">Valor (R$)</th>
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
              <div class="small" *ngIf="isInvalid(i, 'expenseTypeId')">Selecione uma despesa.</div>
            </td>

            <td>
              <input formControlName="quantity" disabled />
            </td>

            <td>
              <select formControlName="projectId" (change)="onProjectChange(i)">
                <option value="" disabled>Selecione...</option>
                <option *ngFor="let p of projects" [value]="p.id">{{ p.name }}</option>
              </select>
              <div class="small" *ngIf="isInvalid(i, 'projectId')">Selecione um projeto.</div>
            </td>

            <td>
              <ng-container *ngIf="taskOptions(i).length > 0; else manualTask">
                <select formControlName="taskId">
                  <option [value]="0" disabled>Selecione...</option>
                  <option *ngFor="let t of taskOptions(i)" [value]="t.id">
                    {{ t.id }} — {{ t.name }}
                  </option>
                </select>
                <div class="small" *ngIf="isLoadingTasks(i)">Carregando tarefas...</div>
              </ng-container>

              <ng-template #manualTask>
                <div class="task-cell">
                  <input type="number" min="1" placeholder="ID da tarefa" formControlName="taskId" (input)="noop()" />
                  <div class="task-help">
                    Informe o <b>IDTRF</b> válido do RM para o projeto selecionado.
                  </div>
                </div>
              </ng-template>

              <div class="small" *ngIf="isInvalid(i, 'taskId')"></div>
            </td>

            <td>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex.: 123.45"
                formControlName="unitPrice"
                (input)="noop()"
              />
              <div class="small" *ngIf="isInvalid(i, 'unitPrice')">Informe um valor maior que 0.</div>
            </td>

            <td>{{ brl(lineTotal(i)) }}</td>

            <td>
              <button type="button" class="link" (click)="removeItem(i)" [disabled]="items.length === 1">remover</button>
            </td>
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

      <div
        class="dropzone"
        [class.dropzone--active]="dragActive"
        (click)="fileInput.click()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        tabindex="0"
        (keydown.enter)="fileInput.click()"
        (keydown.space)="fileInput.click()"
        role="button"
        aria-label="Área para anexar comprovantes. Arraste e solte ou clique para selecionar."
      >
        <input
          #fileInput
          type="file"
          multiple
          (change)="onFiles($event)"
          style="display:none;"
        />

        <div class="dz-title">Arraste e solte seus comprovantes aqui</div>
        <div class="dz-sub">
          ou <span class="dz-link">clique para selecionar</span>
        </div>

        <div class="small" style="margin-top:8px;" *ngIf="files.length === 0">
          Você pode anexar múltiplos arquivos.
        </div>

        <div class="dz-files" *ngIf="files.length">
          <div class="dz-file" *ngFor="let f of files; let idx = index">
            <span class="dz-name">{{ f.name }}</span>
            <button
              type="button"
              class="link"
              (click)="removeFile(idx); $event.stopPropagation()"
              aria-label="Remover arquivo"
            >
              remover
            </button>
          </div>
        </div>

        <div class="small" style="margin-top:10px; color:#b91c1c;" *ngIf="filesMsg">
          {{ filesMsg }}
        </div>
      </div>

      <div class="actions">
        <button type="button" (click)="cancel()">Cancelar</button>
        <button type="button" class="primary" (click)="save()" [disabled]="saving || !canSave()">
          {{ saving ? 'Salvando...' : 'Salvar Solicitação' }}
        </button>
      </div>

      <div class="small" style="margin-top:10px;" *ngIf="errorMsg">{{ errorMsg }}</div>
      <div class="small" style="margin-top:10px; color: #065f46;" *ngIf="successMsg">{{ successMsg }}</div>
    </div>

    <style>
      .dropzone {
        border: 2px dashed rgba(148, 163, 184, 0.9);
        border-radius: 12px;
        padding: 18px;
        text-align: center;
        cursor: pointer;
        user-select: none;
        transition: border-color 120ms ease, background 120ms ease;
        background: rgba(148, 163, 184, 0.06);
        outline: none;
      }
      .dropzone:hover {
        border-color: rgba(59, 130, 246, 0.9);
        background: rgba(59, 130, 246, 0.06);
      }
      .dropzone--active {
        border-color: rgba(59, 130, 246, 0.95);
        background: rgba(59, 130, 246, 0.10);
      }
      .dz-title {
        font-weight: 700;
      }
      .dz-sub {
        margin-top: 6px;
        opacity: 0.9;
      }
      .dz-link {
        color: var(--primary);
        font-weight: 700;
        text-decoration: underline;
      }
      .dz-files {
        margin-top: 14px;
        text-align: left;
        display: grid;
        gap: 8px;
      }
      .dz-file {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(15, 23, 42, 0.04);
      }
      .dz-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    </style>
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
  dragActive = false;
  filesMsg = '';

  tasksByProject: Record<number, Task[]> = {};
  tasksLoading: Record<number, boolean> = {};

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

    this.addItem();
  }

  addItem(): void {
    const g = this.fb.nonNullable.group({
      expenseTypeId: ['', Validators.required],
      projectId: ['', Validators.required],
      taskId: [0, [Validators.required, Validators.min(1)]],
      quantity: [{ value: 1, disabled: true }],
      unitPrice: [0, [Validators.required, Validators.min(0.01)]],
    });

    this.items.push(g);
  }

  removeItem(i: number): void {
    if (this.items.length === 1) return;
    this.items.removeAt(i);
  }

  syncTask(i: number): void {
    const group = this.items.at(i);
    const expenseId = Number(group.get('expenseTypeId')?.value);
    const exp = this.expenses.find((e) => e.id === expenseId);

    const expenseTaskId = exp?.taskId ? Number(exp.taskId) : 0;
    if (!expenseTaskId || expenseTaskId <= 0) return;

    const projectId = Number(group.get('projectId')?.value);
    const opts = projectId ? this.tasksByProject[projectId] ?? [] : [];

    if (opts.length && !opts.some((t) => t.id === expenseTaskId)) return;

    group.get('taskId')?.setValue(expenseTaskId);
  }

  isInvalid(i: number, controlName: string): boolean {
    const g = this.items.at(i);
    const c = g.get(controlName);
    return !!(c && c.touched && c.invalid);
  }

  taskOptions(i: number): Task[] {
    const g = this.items.at(i);
    const pid = Number(g.get('projectId')?.value);
    if (!pid) return [];
    return this.tasksByProject[pid] ?? [];
  }

  isLoadingTasks(i: number): boolean {
    const g = this.items.at(i);
    const pid = Number(g.get('projectId')?.value);
    return !!(pid && this.tasksLoading[pid]);
  }

  onProjectChange(i: number): void {
    const g = this.items.at(i);
    const pid = Number(g.get('projectId')?.value);
    if (!pid) return;

    this.ensureTasksLoaded(pid, g);
  }

  private ensureTasksLoaded(projectId: number, group: any): void {
    if (this.tasksByProject[projectId]?.length) {
      this.ensureTaskIsValid(projectId, group);
      return;
    }
    if (this.tasksLoading[projectId]) return;

    this.tasksLoading[projectId] = true;

    this.api.getTasksByProject(projectId).subscribe({
      next: (tasks) => {
        this.tasksByProject[projectId] = tasks ?? [];
        this.tasksLoading[projectId] = false;
        this.ensureTaskIsValid(projectId, group);
      },
      error: () => {
        this.tasksByProject[projectId] = [];
        this.tasksLoading[projectId] = false;
      },
    });
  }

  private ensureTaskIsValid(projectId: number, group: any): void {
    const tasks = this.tasksByProject[projectId] ?? [];
    if (!tasks.length) return;

    const current = Number(group.get('taskId')?.value);
    if (!current || current <= 0 || !tasks.some((t) => t.id === current)) {
      group.get('taskId')?.setValue(tasks[0].id);
    }
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

  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.dragActive = true;
  }

  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.dragActive = false;
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.dragActive = false;

    const list = ev.dataTransfer?.files ? Array.from(ev.dataTransfer.files) : [];
    this.addFiles(list);
  }

  onFiles(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    this.addFiles(list);

    input.value = '';
  }

  private addFiles(incoming: File[]): void {
    this.filesMsg = '';

    if (!incoming.length) return;

    const key = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;
    const existing = new Map(this.files.map((f) => [key(f), f] as const));

    for (const f of incoming) {
      existing.set(key(f), f);
    }

    this.files = Array.from(existing.values());
  }

  removeFile(idx: number): void {
    this.files = this.files.filter((_, i) => i !== idx);
  }

  cancel(): void {
    this.router.navigateByUrl('/solicitacoes');
  }

  noop(): void {}

  canSave(): boolean {
    return this.items.length > 0 && this.form.valid;
  }

  private extractBackendMessage(err: HttpErrorResponse): string {
    const backend = err.error as any;

    const msg =
      (typeof backend === 'string' && backend) ||
      backend?.message ||
      backend?.Message ||
      backend?.detailedMessage ||
      backend?.DetailedMessage ||
      err.message;

    return (msg && String(msg).trim()) || 'Falha ao salvar.';
  }

  save(): void {
    this.errorMsg = '';
    this.successMsg = '';

    this.form.markAllAsTouched();
    this.items.controls.forEach((g) => g.markAllAsTouched());

    if (!this.canSave()) {
      this.errorMsg = 'Revise os campos obrigatórios.';
      return;
    }

    const ccCode = this.form.controls.costCenterCode.value;
    const cc = this.costCenters.find((x) => x.code === ccCode);

    const vm: ReembolsoFormVM = {
      costCenterCode: ccCode,
      costCenterName: cc?.name ?? '',
      items: this.items.controls.map((g) => {
        const expenseId = Number(g.get('expenseTypeId')?.value);
        const projectId = Number(g.get('projectId')?.value);
        const unitPrice = Number(g.get('unitPrice')?.value);
        const taskId = Number(g.get('taskId')?.value);

        const exp = this.expenses.find((e) => e.id === expenseId);
        const proj = this.projects.find((p) => p.id === projectId);

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

        addLocalRequest({
          id: `local_${Date.now()}`,
          type: 'Reembolso',
          costCenter: cc ? `${cc.code} — ${cc.name}` : ccCode,
          date: new Date().toLocaleDateString('pt-BR'),
          total: this.total(),
          status: 'Em Aprovação',
        });

        this.successMsg = 'Solicitação enviada. Redirecionando...';
        setTimeout(() => this.router.navigateByUrl('/solicitacoes'), 500);
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.errorMsg = this.extractBackendMessage(err);
      },
    });
  }
}
