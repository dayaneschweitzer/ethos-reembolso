// src/app/core/auth/basic-auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

function base64Utf8(input: string): string {
  return btoa(unescape(encodeURIComponent(input)));
}

export const authInterceptorFn: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }

  if (req.headers.has('Authorization')) {
    return next(req);
  }

  const user = environment.apiAuth?.username;
  const pass = environment.apiAuth?.password;

  if (!user || !pass) {
    return next(req);
  }

  const token = base64Utf8(`${user}:${pass}`);

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Basic ${token}`,
      },
    })
  );
};
