import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

// Routes that get the redesigned dark treatment. Anything not listed here —
// dashboard, admin, coach, auth screens — keeps the original navy header.
const PUBLIC_ROUTES = new Set([
  '/',
  '/about',
  '/locations',
  '/swim-lessons',
  '/level-finder',
  '/contact',
  '/faq',
  '/gallery',
  '/certificates'
]);

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, NgClass],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  mobileMenuOpen = false;

  private readonly router = inject(Router);

  constructor(public authService: AuthService) {}

  get isPublicRoute(): boolean {
    const path = this.router.url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
    return PUBLIC_ROUTES.has(path);
  }

  ngOnInit(): void {}

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  logout(): void {
    this.authService.logout();
  }
}
