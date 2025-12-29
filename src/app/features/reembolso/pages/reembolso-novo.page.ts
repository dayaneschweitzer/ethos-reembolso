import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormArray, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ApiClient } from '../../../core/api/api-client';
import { CostCenter } from '../../../core/models/cost-center.model';
import { Project } from '../../../core/models/project.model';
import { ExpenseType } from '../../../core/models/expense.model';
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
            <th style="min-width:180px;">Projeto</th>
            <th style="min-width:220px;">Tipo de Despesa</th>
            <th style="min-width:220px;">Tarefa</th>
            <th style="width:90px;">Qtd</th>
            <th style="width:160px;">Valor (R$)</th>
            <th style="width:140px;">Total</th>
            <th style="width:80px;"></th>
          </tr>
        </thead>

        <tbody>
          <tr *ngFor="let g of items.controls; let i = index" [formGroup]="$any(g)">
            <!-- Projeto -->
            <td>
              <select formControlName="projectId" (change)="onProjectChange(i)">
                <option value="" disabled>Selecione...</option>
                <option *ngFor="let p of projects" [value]="p.id">{{ p.name }}</option>
              </select>
              <div class="small" *ngIf="isInvalid(i, 'projectId')">Selecione um projeto.</div>

              <div class="small" *ngIf="hasProject(i) && isExpensesLoaded(i) && expenseOptions(i).length === 0 && !isLoadingExpenses(i)">
                Não há tipos de despesa configurados para este projeto (ETH.REEM.003 retornou vazio).
                Solicite ao time RM/TOTVS vincular despesas/tarefas ao projeto.
              </div>
            </td>

            <!-- Tipo de Despesa (depende do projeto) -->
            <td>
              <select
                formControlName="expenseTypeId"
                [disabled]="!hasProject(i) || isLoadingExpenses(i) || (hasProject(i) && isExpensesLoaded(i) && expenseOptions(i).length === 0)"
                (change)="onExpenseChange(i)"
                [title]="!hasProject(i) ? 'Selecione um projeto para carregar as despesas' : ''"
              >
                <option value="" disabled>
                  {{ !hasProject(i) ? 'Selecione um projeto primeiro...' : 'Selecione...' }}
                </option>
                <option *ngFor="let e of expenseOptions(i)" [value]="e.id">{{ e.name }}</option>
              </select>

              <div class="small" *ngIf="hasProject(i) && isLoadingExpenses(i)">Carregando despesas...</div>
              <div class="small" *ngIf="isInvalid(i, 'expenseTypeId')">Selecione uma despesa.</div>
            </td>

            <!-- Tarefa -->
            <td>
              <!-- Sem despesa selecionada: não mostra mensagem de erro -->
              <ng-container *ngIf="rowExpenseId(i) === 0">
                <div class="small">Selecione um tipo de despesa para definir a tarefa.</div>
              </ng-container>

              <!-- Com despesa selecionada -->
              <ng-container *ngIf="rowExpenseId(i) !== 0">
                <ng-container *ngIf="hasAutoTask(i); else manualTask">
                  <input type="number" formControlName="taskId" readonly />
                  <div class="small">Tarefa definida automaticamente pela despesa do projeto.</div>
                </ng-container>

                <ng-template #manualTask>
                  <div class="task-cell">
                    <input type="number" min="1" placeholder="ID da tarefa" formControlName="taskId" (input)="noop()" />
                    <div class="task-help">
                      Este tipo de despesa não retornou <b>Tarefa</b> automaticamente. Informe o <b>IDTRF</b> válido do RM.
                    </div>
                  </div>
                </ng-template>

                <div class="small" *ngIf="isInvalid(i, 'taskId')">Informe uma tarefa válida.</div>
              </ng-container>
            </td>

            <!-- Qtd -->
            <td>
              <input formControlName="quantity" disabled />
            </td>

            <!-- Valor -->
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
        <input #fileInput type="file" multiple (change)="onFiles($event)" style="display:none;" />

        <div class="dz-title">Arraste e solte seus comprovantes aqui</div>
        <div class="dz-sub">ou <span class="dz-link">clique para selecionar</span></div>

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
      .dz-title { font-weight: 700; }
      .dz-sub { margin-top: 6px; opacity: 0.9; }
      .dz-link { color: var(--primary); font-weight: 700; text-decoration: underline; }
      .dz-files { margin-top: 14px; text-align: left; display: grid; gap: 8px; }
      .dz-file {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 10px 12px; border-radius: 10px;
        background: rgba(15, 23, 42, 0.04);
      }
      .dz-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .task-cell { display: flex; flex-direction: column; }
      .task-help { margin-top: 10px; font-size: 12px; opacity: 0.85; line-height: 1.2; }
    </style>
  `,
})
export class ReembolsoNovoPage implements OnInit {
  saving = false;
  errorMsg = '';
  successMsg = '';

  costCenters: CostCenter[] = [];
  projects: Project[] = [];

  files: File[] = [];
  dragActive = false;
  filesMsg = '';

  expensesByProject: Record<number, ExpenseType[]> = {};
  expensesLoading: Record<number, boolean> = {};
  expensesLoaded: Record<number, boolean> = {};

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
    this.addItem();
  }

  addItem(): void {
    const g = this.fb.nonNullable.group({
      projectId: ['', Validators.required],
      expenseTypeId: ['', Validators.required],
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

  rowProjectId(i: number): number {
    const g = this.items.at(i);
    return Number(g.get('projectId')?.value || 0);
  }

  rowExpenseId(i: number): number {
    const g = this.items.at(i);
    return Number(g.get('expenseTypeId')?.value || 0);
  }

  hasProject(i: number): boolean {
    return this.rowProjectId(i) > 0;
  }

  isLoadingExpenses(i: number): boolean {
    const pid = this.rowProjectId(i);
    return !!(pid && this.expensesLoading[pid]);
  }

  isExpensesLoaded(i: number): boolean {
    const pid = this.rowProjectId(i);
    return !!(pid && this.expensesLoaded[pid]);
  }

  expenseOptions(i: number): ExpenseType[] {
    const pid = this.rowProjectId(i);
    if (!pid) return [];
    return this.expensesByProject[pid] ?? [];
  }

  private selectedExpense(i: number): ExpenseType | undefined {
    const pid = this.rowProjectId(i);
    const eid = this.rowExpenseId(i);
    if (!pid || !eid) return undefined;
    return (this.expensesByProject[pid] ?? []).find((e) => Number(e.id) === eid);
  }

  hasAutoTask(i: number): boolean {
    const exp = this.selectedExpense(i);
    return !!exp && !!exp.taskId && Number(exp.taskId) > 0;
  }

  onProjectChange(i: number): void {
    const g = this.items.at(i);
    const pid = this.rowProjectId(i);
    if (!pid) return;

    // Reset dependências
    g.get('expenseTypeId')?.setValue('');
    g.get('taskId')?.setValue(0);

    this.ensureExpensesLoaded(pid, g);
  }

  private ensureExpensesLoaded(projectId: number, group: any): void {
    // Se já carregou antes, só aplica default/auto-task se necessário
    if (this.expensesLoaded[projectId] && (this.expensesByProject[projectId]?.length ?? 0) >= 0) {
      this.applyDefaultExpenseAndTask(projectId, group);
      return;
    }

    if (this.expensesLoading[projectId]) return;

    this.expensesLoading[projectId] = true;
    this.expensesLoaded[projectId] = false;

    this.api.getExpensesByProject(projectId).subscribe({
      next: (list) => {
        this.expensesByProject[projectId] = list ?? [];
        this.expensesLoading[projectId] = false;
        this.expensesLoaded[projectId] = true;

        this.applyDefaultExpenseAndTask(projectId, group);
      },
      error: () => {
        this.expensesByProject[projectId] = [];
        this.expensesLoading[projectId] = false;
        this.expensesLoaded[projectId] = true; // carregou, porém vazio por falha

        // mantém os campos como estão para não quebrar a edição
      },
    });
  }

  private applyDefaultExpenseAndTask(projectId: number, group: any): void {
    const list = this.expensesByProject[projectId] ?? [];
    if (!list.length) return;

    const currentExpenseId = Number(group.get('expenseTypeId')?.value || 0);
    if (!currentExpenseId || !list.some((e) => Number(e.id) === currentExpenseId)) {
      group.get('expenseTypeId')?.setValue(String(list[0].id));
    }

    // depois de garantir despesa válida, tenta preencher task automaticamente
    const eid = Number(group.get('expenseTypeId')?.value || 0);
    const exp = list.find((e) => Number(e.id) === eid);
    const taskId = exp?.taskId ? Number(exp.taskId) : 0;
    group.get('taskId')?.setValue(taskId > 0 ? taskId : 0);
  }

  onExpenseChange(i: number): void {
    const g = this.items.at(i);
    const exp = this.selectedExpense(i);
    const taskId = exp?.taskId ? Number(exp.taskId) : 0;
    g.get('taskId')?.setValue(taskId > 0 ? taskId : 0);
  }

  isInvalid(i: number, controlName: string): boolean {
    const g = this.items.at(i);
    const c = g.get(controlName);
    return !!(c && c.touched && c.invalid);
  }

  lineTotal(i: number): number {
    const g = this.items.at(i);
    const unit = Number(g.get('unitPrice')?.value ?? 0);
    return unit; // qtd sempre 1
  }

  total(): number {
    return sum(this.items.controls.map((_, i) => this.lineTotal(i)));
  }

  brl(v: number): string {
    return formatBRL(v);
  }

  // ===== Comprovantes (drag & drop + selecionar) =====
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
    for (const f of incoming) existing.set(key(f), f);

    this.files = Array.from(existing.values());
  }

  removeFile(idx: number): void {
    this.files = this.files.filter((_, i) => i !== idx);
  }
  // ================================================

  cancel(): void {
    this.router.navigateByUrl('/solicitacoes');
  }

  noop(): void {}

  canSave(): boolean {
    // Se o projeto não tem despesas (ETH.REEM.003 vazio), a tela não consegue seguir com seleção segura.
    // Mantém o bloqueio para evitar salvar movimento sem classificação.
    const hasProjectWithoutExpenses = this.items.controls.some((g) => {
      const pid = Number(g.get('projectId')?.value || 0);
      if (!pid) return false;
      if (this.expensesLoading[pid]) return true; // ainda carregando, bloqueia salvar
      if (!this.expensesLoaded[pid]) return true; // ainda não carregou, bloqueia salvar
      return (this.expensesByProject[pid] ?? []).length === 0;
    });

    if (hasProjectWithoutExpenses) return false;

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
      this.errorMsg = 'Revise os campos obrigatórios (e confirme se o projeto possui despesas configuradas no RM).';
      return;
    }

    const ccCode = this.form.controls.costCenterCode.value;
    const cc = this.costCenters.find((x) => x.code === ccCode);

    const vm: ReembolsoFormVM = {
      costCenterCode: ccCode,
      costCenterName: cc?.name ?? '',
      items: this.items.controls.map((g) => {
        const projectId = Number(g.get('projectId')?.value);
        const expenseId = Number(g.get('expenseTypeId')?.value);
        const unitPrice = Number(g.get('unitPrice')?.value);
        const taskId = Number(g.get('taskId')?.value);

        const exp = (this.expensesByProject[projectId] ?? []).find((e) => Number(e.id) === expenseId);
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
