import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { ApiService } from '../services/api.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const api = inject(ApiService);
  const authReq = req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh') && !req.url.includes('/auth/login') && !req.url.includes('/auth/register')) {
        return api.refresh().pipe(
          switchMap(() => next(authReq)),
          catchError((refreshErr) => {
            router.navigate(['/login'], {
              queryParams: { message: 'Session expired. Please login again.', returnUrl: router.url }
            });
            return throwError(() => refreshErr);
          })
        );
      }
      if (error.status === 401 || error.status === 403 || error.status === 423) {
        if (error.status === 423) {
          const sec = (error as any).error?.secondsRemaining ?? 0;
          router.navigate(['/login'], {
            queryParams: { message: `Account locked. Try again in ${Math.ceil(sec / 60)} minutes.`, returnUrl: router.url }
          });
        } else {
          router.navigate(['/login'], {
            queryParams: {
              message: error.status === 403 ? 'Access denied.' : 'Session expired. Please login again.',
              returnUrl: router.url
            }
          });
        }
      }

      const friendlyMessage =
        error.status === 0
          ? 'Cannot reach server. Please check your connection.'
          : error.error?.message || 'Something went wrong. Please try again.';

      return throwError(() => new Error(friendlyMessage));
    })
  );
};
