import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from './shared/footer/footer.component';
import { isPublicUrl } from './shared/public-routes';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'SwimXpert';

  private readonly router = inject(Router);

  /** Gates the public design tokens; see src/app/styles/public-tokens.css. */
  get isPublicRoute(): boolean {
    return isPublicUrl(this.router.url);
  }
}
