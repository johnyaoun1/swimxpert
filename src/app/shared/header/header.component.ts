import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { isPublicUrl } from '../public-routes';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, NgClass],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  mobileMenuOpen = false;

  readonly whatsappUrl =
    'https://wa.me/96176144927?text=Hi%2C%20I%27d%20like%20to%20book%20a%20swimming%20lesson%20for%20my%20child';

  private readonly router = inject(Router);

  constructor(public authService: AuthService) {}

  get isPublicRoute(): boolean {
    return isPublicUrl(this.router.url);
  }

  ngOnInit(): void {}

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  logout(): void {
    this.authService.logout();
  }
}
