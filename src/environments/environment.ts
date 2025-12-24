// src/environments/environment.ts
export const environment = {
  production: false,
  useMocks: false,

  apiBaseUrl: '/api',
  defaultUserCode: '00060',

  apiAuth: {
    username: 'web',
    password: 'Ethos@2025@',
  },

  // Defaults que fizeram o POST funcionar no Postman
  rmReemDefaults: {
    companyId: 1,
    branchId: 1,

    series: 'REEM',
    movementTypeCode: '1.1.01',
    type: 'A',
    status: 'A',

    warehouseCode: '01.001',
    destinyWarehouseCode: '01.001',
    destinyBranchId: 1,

    customerVendorCompanyId: 1,
    customerVendorCode: '00060',
    auxCustomerVendorCompanyId: 1,
    auxCustomerVendorCode: '00060',

    paymentTermCode: '00030',
    cashAccountCompanyId: 1,
    cashAccountCode: '04',

    aplicationIntegration: 'T',
    netValueCurrencyCode: 'R$',

    productId: 15914,

    bugdetNatureCompanyId: 0,
    bugdetNatureCode: '3.01.01.01',
  },
};
