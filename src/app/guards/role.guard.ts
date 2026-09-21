import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';
import { redirectIfPasswordChangeRequired } from './auth.guard';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = ((route.data?.['roles'] as string[] | undefined) ?? []).map((r) => r.toLowerCase());

  return authService.isAuthenticated().pipe(
    map((isAuthenticated) => {
      const forced = redirectIfPasswordChangeRequired(authService, router, state.url);
      if (isAuthenticated && forced) return forced;
      const currentUser = authService.getCurrentUser();
      const currentRole = (currentUser?.role ?? '').toString().toLowerCase();
      const hasRole = allowedRoles.length === 0 || allowedRoles.includes(currentRole);

      if (isAuthenticated && hasRole) {
        return true;
      }

      return router.createUrlTree(['/dashboard'], {
        queryParams: { message: 'Access denied.' }
      });
    })
  );
};
