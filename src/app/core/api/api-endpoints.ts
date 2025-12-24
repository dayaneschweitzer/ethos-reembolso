import { environment } from '../../../environments/environment';

const base = environment.apiBaseUrl.replace(/\/$/, '');

export const API = {
  base,

  costCenters: () =>
    `${base}/framework/v1/consultaSQLServer/RealizaConsulta/ETH.REEM.001/0/T/`,

  projects: () =>
    `${base}/framework/v1/consultaSQLServer/RealizaConsulta/ETH.REEM.002/0/T/`,

  expenses: () =>
    `${base}/framework/v1/consultaSQLServer/RealizaConsulta/ETH.REEM.003/0/T/`,

  userRequests: () =>
    `${base}/framework/v1/consultaSQLServer/RealizaConsulta/ETH.REEM.004/0/T/`,

  // Lista tarefas por projeto (IDPRJ). Ajuste o código da consulta caso seu RM use outro.
  tasksByProject: () =>
    `${base}/framework/v1/consultaSQLServer/RealizaConsulta/ETH.REEM.005/0/T/`,

  movements: () =>
    `${base}/mov/v1/Movements`,
};
