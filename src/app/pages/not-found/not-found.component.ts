import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.scss']
})
export class NotFoundComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);

  /** Shown so the visitor can see which address failed. */
  readonly attemptedUrl = this.router.url;

  ngOnInit(): void {
    this.seo.updatePage({
      title: 'Page not found - SwimXpert',
      description: 'That page does not exist. Browse swimming lessons, locations and contact details for SwimXpert in Lebanon.',
      path: '/404',
      // Unknown URLs must not be indexed.
      robots: 'noindex, follow'
    });
  }
}
