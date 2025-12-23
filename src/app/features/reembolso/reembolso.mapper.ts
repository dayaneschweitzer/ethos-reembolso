// src/app/features/reembolso/reembolso.mapper.ts
import { environment } from '../../../environments/environment';
import { sum } from '../../core/shared/utils/money';

export interface ReembolsoItemVM {
  expenseTypeId: number;
  expenseName: string;

  projectId: number;
  projectName: string;

  taskId: number;

  quantity: number;
  unitPrice: number;
}

export interface ReembolsoFormVM {
  costCenterCode: string;
  costCenterName: string;
  items: ReembolsoItemVM[];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoLocalMidnightWithOffset(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());

  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? '+' : '-';
  const abs = Math.abs(tzMin);
  const hh = pad2(Math.floor(abs / 60));
  const mi = pad2(abs % 60);

  return `${yyyy}-${mm}-${dd}T00:00:00${sign}${hh}:${mi}`;
}

function toNumber(v: any, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function assert(cond: any, msg: string): void {
  if (!cond) throw new Error(msg);
}

export function buildMovementPayload(vm: ReembolsoFormVM) {
  const cfg = environment.rmReemDefaults;

  assert(vm && typeof vm === 'object', 'Dados inválidos do formulário.');
  assert(!!vm.costCenterCode, 'Selecione um Centro de Custo.');
  assert(Array.isArray(vm.items) && vm.items.length > 0, 'Adicione ao menos 1 item.');

  const itemTotals = vm.items.map((it, idx) => {
    const i = idx + 1;

    const qty = toNumber(it.quantity, 1);
    const unit = toNumber(it.unitPrice, 0);
    const projectId = toNumber(it.projectId, 0);
    const taskId = toNumber(it.taskId, 0);

    assert(qty > 0, `Item ${i}: quantidade inválida.`);
    assert(unit > 0, `Item ${i}: informe um valor maior que 0.`);
    assert(projectId > 0, `Item ${i}: selecione um Projeto.`);
    assert(taskId > 0, `Item ${i}: selecione/defina uma Tarefa.`);

    return qty * unit;
  });

  const total = sum(itemTotals);

  const now = new Date();
  const isoDate = isoLocalMidnightWithOffset(now);

  return {
    companyId: cfg.companyId,
    branchId: cfg.branchId,

    series: cfg.series,
    movementTypeCode: cfg.movementTypeCode,
    type: cfg.type,
    status: cfg.status,

    warehouseCode: cfg.warehouseCode,
    destinyWarehouseCode: cfg.destinyWarehouseCode,

    customerVendorCompanyId: cfg.customerVendorCompanyId,
    customerVendorCode: cfg.customerVendorCode,
    auxCustomerVendorCompanyId: cfg.auxCustomerVendorCompanyId,
    auxCustomerVendorCode: cfg.auxCustomerVendorCode,

    paymentTermCode: cfg.paymentTermCode,
    cashAccountCode: cfg.cashAccountCode,
    cashAccountCompanyId: cfg.cashAccountCompanyId,
    aplicationIntegration: cfg.aplicationIntegration,

    registerDate: isoDate,
    date: isoDate,

    grossValue: total,
    netValue: total,
    otherValues: total,

    movementItems: vm.items.map((it, idx) => {
      const seq = idx + 1;
      const qty = toNumber(it.quantity, 1);
      const unit = toNumber(it.unitPrice, 0);
      const itemTotal = qty * unit;

      const projectId = toNumber(it.projectId, 0);
      const taskId = toNumber(it.taskId, 0);

      return {
        companyId: cfg.companyId,

        sequentialId: seq,
        sequentialNumber: seq,

        productId: cfg.productId,

        quantity: qty,
        unitPrice: unit,

        registerDate: isoDate,
        warehouseCode: cfg.warehouseCode,

        bugdetNatureCompanyId: cfg.bugdetNatureCompanyId,
        bugdetNatureCode: cfg.bugdetNatureCode,

        costCenterApportionments: [
          {
            companyId: cfg.companyId,
            movementItemSequentialId: seq,
            costCenterCode: vm.costCenterCode,
            percentage: 100.0,
            projectId,
            taskId,
            value: itemTotal,
          },
        ],

        departmentApportionments: [],
      };
    }),
  };
}
