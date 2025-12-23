import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';

import { COST_CENTERS } from './data/cost-centers.mock';
import { PROJECTS } from './data/projects.mock';
import { EXPENSES } from './data/expenses.mock';
import { REQUESTS_DB } from './data/mock-db';

function has(url: string, needle: string): boolean {
  return url.includes(needle);
}

type MovementPayload = {
  movementItems?: unknown[];
};

export const mockInterceptorFn: HttpInterceptorFn = (req, next) => {
  const url = req.url;

  // ETH.REEM.001 Centro de Custo
  if (has(url, '/RealizaConsulta/ETH.REEM.001')) {
    return of(new HttpResponse({ status: 200, body: COST_CENTERS })).pipe(delay(250));
  }

  // ETH.REEM.002 Projetos
  if (has(url, '/RealizaConsulta/ETH.REEM.002')) {
    return of(new HttpResponse({ status: 200, body: PROJECTS })).pipe(delay(250));
  }

  // ETH.REEM.003 Despesas
  if (has(url, '/RealizaConsulta/ETH.REEM.003')) {
    return of(new HttpResponse({ status: 200, body: EXPENSES })).pipe(delay(250));
  }

  // ETH.REEM.004 Solicitações do usuário
  if (has(url, '/RealizaConsulta/ETH.REEM.004')) {
    return of(new HttpResponse({ status: 200, body: REQUESTS_DB.list() })).pipe(delay(300));
  }

  // POST Movements
  if (has(url, '/mov/v1/Movements') && req.method === 'POST') {
    const payload = req.body as MovementPayload | null;

    if (!payload?.movementItems || payload.movementItems.length === 0) {
      return throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: 'Nenhum item informado.' },
          })
      );
    }

    const created = REQUESTS_DB.addFromMovementPayload(req.body as any);
    return of(new HttpResponse({ status: 201, body: created })).pipe(delay(400));
  }

  return next(req);
};
