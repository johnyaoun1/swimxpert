import { inject } from '@angular/core';
import { Router, CanActivateFn, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';

/** Sends an account that still has a temporary password to the change-password page. */
export function redirectIfPasswordChangeRequired(
  authService: AuthService,
  router: Router,
  url: string
): UrlTree | null {
  if (authService.currentUser()?.mustChangePassword !== true) return null;
  const path = url.split('?')[0];
  if (path === '/change-password') return null;
  return router.createUrlTree(['/change-password']);
}

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  return authService.isAuthenticated().pipe(
    map((isAuthenticated) => {
      if (!isAuthenticated) {
        return router.createUrlTree(['/login'], {
          queryParams: {
            message: 'Please login to continue.',
            returnUrl: state.url
          }
        });
      }
      return redirectIfPasswordChangeRequired(authService, router, state.url) ?? true;
    })
  );
};
