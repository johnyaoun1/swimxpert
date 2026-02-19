import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('swimxpert_token');

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        localStorage.removeItem('swimxpert_token');
        localStorage.removeItem('swimxpert_user');
        router.navigate(['/login'], {
          queryParams: {
            message: 'Session expired. Please login again.',
            returnUrl: router.url
          }
        });
      }

      const friendlyMessage =
        error.status === 0
          ? 'Cannot reach server. Please check your connection.'
          : error.error?.message || 'Something went wrong. Please try again.';

      return throwError(() => new Error(friendlyMessage));
    })
  );
};
