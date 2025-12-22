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

export function buildMovementPayload(vm: ReembolsoFormVM) {
  const total = sum(vm.items.map(i => i.unitPrice));

  const now = new Date();
  const isoDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();

  return {
    internalId: "1|9999",
    companyId: 1,
    movementId: 9999,
    branchId: 1,
    warehouseCode: "01.001",
    destinyWarehouseCode: "01.001",
    customerVendorCode: "00060",
    series: "REEM",
    movementTypeCode: "1.1.01",
    type: "A",
    status: "A",
    printed: false,
    documentPrinted: false,
    billPrinted: false,
    registerDate: isoDate,
    grossValue: total,
    netValue: total,
    otherValues: total,
    date: isoDate,
    costCenterCode: vm.costCenterCode,
    movementItems: vm.items.map((it, idx) => ({
      companyId: 1,
      movementId: 9999,
      sequentialId: idx + 1,
      sequentialNumber: idx + 1,
      productId: 15914,
      quantity: 1.0,
      unitPrice: it.unitPrice,
      measureUnitCode: "UN",
      receivableQuantity: 1.0,
      originalQuantity: 1.0,
      bugdetNatureCompanyId: 0,
      bugdetNatureCode: "3.01.01.01",
      warehouseCode: "01.001",
      netValue: it.unitPrice,
      grossValue: it.unitPrice,
      originalGrossValue: it.unitPrice,
      aplicationIntegration: "T",
      complementaryFields: {},
      costCenterApportionments: [
        {
          companyId: 1,
          movementId: 9999,
          movementItemSequentialId: idx + 1,
          costCenterCode: vm.costCenterCode,
          percentage: 100.0,
          projectId: it.projectId,
          taskId: it.taskId,
        }
      ],
      departmentApportionments: [],
      taxes: [],
      itemLots: [],
      itemGrids: [],
      itemSerialNumber: [],
      itemHeritage: [],
      fiscal: [],
      reserves: [],
      relatedItem: [],
      exportRelatedItem: [],
      linkedItem: [],
      exportMemo: [],
      judicialProcess: []
    })),
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
    electronicInvoiceFreeFields: []
  };
}
