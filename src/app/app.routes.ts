import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'solicitacoes' },
  {
    path: 'solicitacoes',
    loadComponent: () => import('./features/solicitacoes/pages/solicitacoes-list.page').then(m => m.SolicitacoesListPage),
  },
  {
    path: 'reembolso/novo',
    loadComponent: () => import('./features/reembolso/pages/reembolso-novo.page').then(m => m.ReembolsoNovoPage),
  },
  { path: '**', redirectTo: 'solicitacoes' },
];
