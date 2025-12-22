import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { mockInterceptorFn } from './core/mock/mock.interceptor';

(window as any).__USE_MOCKS__ = environment.useMocks === true;

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      environment.useMocks ? withInterceptors([mockInterceptorFn]) : withInterceptors([])
    ),
  ],
};
