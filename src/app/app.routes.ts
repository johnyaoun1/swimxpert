import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { roleGuard } from './guards/role.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent), title: 'Home - SwimXpert' },
  { path: 'about', loadComponent: () => import('./pages/about/about.component').then((m) => m.AboutComponent), title: 'About Us - SwimXpert' },
  { path: 'locations', loadComponent: () => import('./pages/locations/locations.component').then((m) => m.LocationsComponent), title: 'Locations - SwimXpert' },
  { path: 'swim-lessons', loadComponent: () => import('./pages/swim-lessons/swim-lessons.component').then((m) => m.SwimLessonsComponent), title: 'Swim Lessons - SwimXpert' },
  { path: 'level-finder', loadComponent: () => import('./pages/level-finder/level-finder.component').then((m) => m.LevelFinderComponent), title: 'Level Finder - SwimXpert' },
  { path: 'contact', loadComponent: () => import('./pages/contact/contact.component').then((m) => m.ContactComponent), title: 'Contact Us - SwimXpert' },
  { path: 'gallery', loadComponent: () => import('./pages/gallery/gallery.component').then((m) => m.GalleryComponent), title: 'Gallery - SwimXpert' },
  { path: 'certificates', loadComponent: () => import('./pages/certificates/certificates.component').then((m) => m.CertificatesComponent), title: 'Certificates - SwimXpert' },
  { path: 'quizzes', loadComponent: () => import('./pages/quizzes/quizzes.component').then((m) => m.QuizzesComponent), title: 'Swimming Quiz - SwimXpert', canActivate: [authGuard] },
  { path: 'leaderboard', loadComponent: () => import('./pages/leaderboard/leaderboard.component').then((m) => m.LeaderboardComponent), title: 'Leaderboard - SwimXpert', canActivate: [authGuard] },
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent), title: 'Login - SwimXpert' },
  { path: 'signup', loadComponent: () => import('./pages/signup/signup.component').then((m) => m.SignupComponent), title: 'Sign Up - SwimXpert' },
  { path: 'verify-email', loadComponent: () => import('./pages/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent), title: 'Verify Email - SwimXpert' },
  { path: 'forgot-password', loadComponent: () => import('./pages/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent), title: 'Forgot Password - SwimXpert' },
  { path: 'reset-password', loadComponent: () => import('./pages/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent), title: 'Reset Password - SwimXpert' },
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent), title: 'Dashboard - SwimXpert', canActivate: [authGuard] },
  { path: 'admin', loadComponent: () => import('./pages/admin-dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent), title: 'Admin Dashboard - SwimXpert', canActivate: [adminGuard] },
  { path: 'admin/schedule', loadComponent: () => import('./pages/admin-schedule/admin-schedule.component').then((m) => m.AdminScheduleComponent), title: 'Schedule - SwimXpert', canActivate: [adminGuard] },

  // Sessions
  { path: 'sessions', loadComponent: () => import('./pages/sessions-list/sessions-list.component').then((m) => m.SessionsListComponent), title: 'Sessions - SwimXpert', canActivate: [authGuard] },
  { path: 'sessions/create', loadComponent: () => import('./pages/session-form/session-form.component').then((m) => m.SessionFormComponent), title: 'Create Session - SwimXpert', canActivate: [authGuard, roleGuard], data: { roles: ['Coach', 'Admin'] } },
  { path: 'sessions/edit/:id', loadComponent: () => import('./pages/session-form/session-form.component').then((m) => m.SessionFormComponent), title: 'Edit Session - SwimXpert', canActivate: [authGuard, roleGuard], data: { roles: ['Coach', 'Admin'] } },
  { path: 'sessions/:id', loadComponent: () => import('./pages/session-detail/session-detail.component').then((m) => m.SessionDetailComponent), title: 'Session Detail - SwimXpert', canActivate: [authGuard] },

  // Coach
  { path: 'coach/dashboard', loadComponent: () => import('./pages/coach-dashboard/coach-dashboard.component').then((m) => m.CoachDashboardComponent), title: 'Coach Dashboard - SwimXpert', canActivate: [authGuard, roleGuard], data: { roles: ['Coach', 'Admin'] } },

  // Swimmer
  { path: 'swimmer/dashboard', loadComponent: () => import('./pages/swimmer-dashboard/swimmer-dashboard.component').then((m) => m.SwimmerDashboardComponent), title: 'Swimmer Dashboard - SwimXpert', canActivate: [authGuard] },
  { path: 'my-sessions', loadComponent: () => import('./pages/my-sessions/my-sessions.component').then((m) => m.MySessionsComponent), title: 'My Sessions - SwimXpert', canActivate: [authGuard] },

  // Admin
  { path: 'admin/users', loadComponent: () => import('./pages/admin-users/admin-users.component').then((m) => m.AdminUsersComponent), title: 'Admin Users - SwimXpert', canActivate: [authGuard, roleGuard], data: { roles: ['Admin'] } },
  { path: 'admin/audit', loadComponent: () => import('./pages/admin-audit/admin-audit.component').then((m) => m.AdminAuditComponent), title: 'Audit Log - SwimXpert', canActivate: [authGuard, roleGuard], data: { roles: ['Admin'] } },
  { path: 'admin/security', loadComponent: () => import('./pages/admin-security/admin-security.component').then((m) => m.AdminSecurityComponent), title: 'Security & 2FA - SwimXpert', canActivate: [authGuard, roleGuard], data: { roles: ['Admin'] } },

  // Payments
  { path: 'payments/record', loadComponent: () => import('./pages/record-payment/record-payment.component').then((m) => m.RecordPaymentComponent), title: 'Record Payment - SwimXpert', canActivate: [authGuard, roleGuard], data: { roles: ['Coach', 'Admin'] } },
  { path: 'payments/history', loadComponent: () => import('./pages/my-payments/my-payments.component').then((m) => m.MyPaymentsComponent), title: 'My Payments - SwimXpert', canActivate: [authGuard] },

  { path: '**', redirectTo: '' }
];
