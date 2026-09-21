import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';
import { redirectIfPasswordChangeRequired } from './auth.guard';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  return authService.isAuthenticated().pipe(
    map((isAuthenticated) => {
      const forced = redirectIfPasswordChangeRequired(authService, router, state.url);
      if (isAuthenticated && forced) return forced;
      const currentUser = authService.getCurrentUser();
      const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin';
      return (isAuthenticated && isAdmin)
        ? true
        : router.createUrlTree(['/dashboard'], {
            queryParams: { message: 'Access denied: Admin only.' }
          });
    }
    )
  );
};
