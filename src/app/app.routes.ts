import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { AboutComponent } from './pages/about/about.component';
import { LocationsComponent } from './pages/locations/locations.component';
import { SwimLessonsComponent } from './pages/swim-lessons/swim-lessons.component';
import { LevelFinderComponent } from './pages/level-finder/level-finder.component';
import { ContactComponent } from './pages/contact/contact.component';
import { GalleryComponent } from './pages/gallery/gallery.component';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { CertificatesComponent } from './pages/certificates/certificates.component';
import { QuizzesComponent } from './pages/quizzes/quizzes.component';
import { LeaderboardComponent } from './pages/leaderboard/leaderboard.component';
import { Strokes3dComponent } from './pages/strokes-3d/strokes-3d.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Home - SwimXpert' },
  { path: 'about', component: AboutComponent, title: 'About Us - SwimXpert' },
  { path: 'locations', component: LocationsComponent, title: 'Locations - SwimXpert' },
  { path: 'swim-lessons', component: SwimLessonsComponent, title: 'Swim Lessons - SwimXpert' },
  { path: 'level-finder', component: LevelFinderComponent, title: 'Level Finder - SwimXpert' },
  { path: 'contact', component: ContactComponent, title: 'Contact Us - SwimXpert' },
  { path: 'gallery', component: GalleryComponent, title: 'Gallery - SwimXpert' },
  { path: 'certificates', component: CertificatesComponent, title: 'Certificates - SwimXpert' },
  { path: 'quizzes', component: QuizzesComponent, title: 'Swimming Quiz - SwimXpert' },
  { path: 'leaderboard', component: LeaderboardComponent, title: 'Leaderboard - SwimXpert' },
  { path: 'strokes-3d', component: Strokes3dComponent, title: '3D Swimming Strokes - SwimXpert' },
  { path: 'login', component: LoginComponent, title: 'Login - SwimXpert' },
  { path: 'signup', component: SignupComponent, title: 'Sign Up - SwimXpert' },
  { path: 'dashboard', component: DashboardComponent, title: 'Dashboard - SwimXpert', canActivate: [authGuard] },
  { path: 'admin', component: AdminDashboardComponent, title: 'Admin Dashboard - SwimXpert', canActivate: [adminGuard] },
  { path: '**', redirectTo: '' }
];
