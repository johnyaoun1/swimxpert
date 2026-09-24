import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { isPublicUrl } from '../public-routes';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  currentYear = new Date().getFullYear();

  readonly whatsappUrl =
    'https://wa.me/96176144927?text=Hi%2C%20I%27d%20like%20to%20book%20a%20swimming%20lesson%20for%20my%20child';

  get isPublicRoute(): boolean {
    return isPublicUrl(this.router.url);
  }
}
