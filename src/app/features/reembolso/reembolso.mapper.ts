// src/app/features/reembolso/reembolso.mapper.ts
import { environment } from '../../../environments/environment';
import { sum } from '../../core/shared/utils/money';

export interface ReembolsoItemVM {
  expenseTypeId: number;
  expenseName: string;
  projectId: number;
  projectName: string;
  taskId: number;
  quantity: 1;
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

export function buildMovementPayload(vm: ReembolsoFormVM) {
  const cfg = environment.rmReemDefaults;

  const total = sum(vm.items.map((i) => Number(i.unitPrice || 0)));
  const now = new Date();
  const isoDate = isoLocalMidnightWithOffset(now);

  return {
    companyId: cfg.companyId,
    branchId: cfg.branchId,

    warehouseCode: cfg.warehouseCode,
    destinyWarehouseCode: cfg.destinyWarehouseCode,

    customerVendorCode: cfg.customerVendorCode,
    customerVendorCompanyId: cfg.customerVendorCompanyId,
    auxCustomerVendorCode: cfg.auxCustomerVendorCode,
    auxCustomerVendorCompanyId: cfg.auxCustomerVendorCompanyId,

    series: cfg.series,
    movementTypeCode: cfg.movementTypeCode,
    type: cfg.type,
    status: cfg.status,

    printed: false,
    documentPrinted: false,
    billPrinted: false,

    registerDate: isoDate,
    date: isoDate,

    paymentTermCode: cfg.paymentTermCode,
    netValueCurrencyCode: cfg.netValueCurrencyCode,

    cashAccountCode: cfg.cashAccountCode,
    cashAccountCompanyId: cfg.cashAccountCompanyId,
    destinyBranchId: cfg.destinyBranchId,

    grossValue: total,
    netValue: total,
    otherValues: total,

    aplicationIntegration: cfg.aplicationIntegration,
    complementaryFields: {},

    movementItems: vm.items.map((it, idx) => {
      const seq = idx + 1;
      const v = Number(it.unitPrice || 0);

      return {
        companyId: cfg.companyId,

        sequentialId: seq,
        sequentialNumber: seq,

        productId: cfg.productId,
        quantity: 1.0,
        unitPrice: v,
        totalPrice: v,
        tablePrice: 0.0,

        branchId: cfg.branchId,
        registerDate: isoDate,

        warehouseCode: cfg.warehouseCode,

        bugdetNatureCompanyId: cfg.bugdetNatureCompanyId,
        bugdetNatureCode: cfg.bugdetNatureCode,

        aplicationIntegration: cfg.aplicationIntegration,
        complementaryFields: {},

        costCenterApportionments: [
          {
            companyId: cfg.companyId,
            movementItemSequentialId: seq,
            costCenterCode: vm.costCenterCode,
            percentage: 100.0,
            projectId: Number(it.projectId),
            taskId: Number(it.taskId),
          },
        ],

        departmentApportionments: [],
        taxes: [],
        itemLots: [],
        itemGrids: [],
        itemSerialNumber: [],
        itemHeritage: [],
        siscoServFitting: [],
        fiscal: [],
        reserves: [],
        relatedItem: [],
        exportRelatedItem: [],
        linkedItem: [],
        exportMemo: [],
        judicialProcess: [],
      };
    }),

    payments: [],
    costCenterApportionments: [],
    departmentApportionments: [],
    taxes: [],
    fiscal: [],
    norm: [],
    cargoComponent: [],
    thirdPartyNF: [],
    safetyDevice: [],
    nfe: [],
    inputCTRC: [],
    outputCTRC: [],
    ctrc: [],
    transportData: [],
    documentAuthorization: [],
    judicialProcess: [],
    serviceOrder: [],
    relatedMovement: [],
    exportRelatedMovement: [],
    linkedMovement: [],
    cTe: [],
    eaiIntegration: [],
    electronicInvoiceFreeFields: [],
  };
}
