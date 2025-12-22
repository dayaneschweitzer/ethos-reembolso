import { environment } from '../../../environments/environment';

export const API = {
  base: environment.apiBaseUrl,
  costCenters: () => `${environment.apiBaseUrl}/framework/v1/consultaSQLServer/RealizaConsulta/ETH.REEM.001/0/T/`,
  projects:    () => `${environment.apiBaseUrl}/framework/v1/consultaSQLServer/RealizaConsulta/ETH.REEM.002/0/T/`,
  expenses:    () => `${environment.apiBaseUrl}/framework/v1/consultaSQLServer/RealizaConsulta/ETH.REEM.003/0/T/`,
  userRequests: () => `${environment.apiBaseUrl}/framework/v1/consultaSQLServer/RealizaConsulta/ETH.REEM.004/0/T`,
  movements:   () => `${environment.apiBaseUrl}/mov/v1/Movements/`,
};
