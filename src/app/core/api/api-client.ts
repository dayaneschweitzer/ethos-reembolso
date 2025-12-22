import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API } from './api-endpoints';
import { CostCenter } from '../models/cost-center.model';
import { Project } from '../models/project.model';
import { ExpenseType } from '../models/expense.model';
import { RequestListItem } from '../models/request.model';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  constructor(private http: HttpClient) {}

  getCostCenters(): Observable<CostCenter[]> {
    return this.http.get<CostCenter[]>(API.costCenters());
  }

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(API.projects());
  }

  getExpenses(): Observable<ExpenseType[]> {
    return this.http.get<ExpenseType[]>(API.expenses());
  }

  getUserRequests(userCode: string): Observable<RequestListItem[]> {
    return this.http.get<RequestListItem[]>(API.userRequests(), {
      params: { parameters: `USUARIO='${userCode}'` },
    });
  }

  saveMovement(payload: unknown): Observable<any> {
    return this.http.post(API.movements(), payload);
  }
}
