import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly whatsappUrl =
    'https://wa.me/96176144927?text=Hi%2C%20I%27d%20like%20to%20book%20a%20swimming%20lesson%20for%20my%20child';

  /** Drives the floating WhatsApp button, which only appears past the hero. */
  pastHero = false;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly seo = inject(SeoService);
  private readonly cdr = inject(ChangeDetectorRef);
  private observer?: IntersectionObserver;
  private heroObserver?: IntersectionObserver;

  ngOnInit(): void {
    this.seo.updatePage({
      title: 'SwimXpert | Swimming Lessons & Coaching in Lebanon',
      description:
        'SwimXpert provides professional swimming lessons for children and adults across Lebanon. Expert coaches, beginner to advanced programs, and private sessions available.',
      path: '/',
      keywords:
        'swimming lessons lebanon, swimming classes beirut, kids swimming lessons, private swimming coach lebanon'
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const root = this.host.nativeElement;
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Before the reduced-motion branch returns: the floating button is a
    // control, not decoration, so it appears either way.
    this.watchHero(root);

    if (reduceMotion) {
      targets.forEach((el) => el.classList.add('is-visible'));
      root.querySelector<HTMLVideoElement>('[data-hero-video]')?.pause();
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          this.observer?.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 }
    );

    targets.forEach((el) => this.observer?.observe(el));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.heroObserver?.disconnect();
  }

  /** Reveals the floating WhatsApp button once the hero has scrolled away. */
  private watchHero(root: HTMLElement): void {
    const hero = root.querySelector('.hero');
    if (!hero) return;

    this.heroObserver = new IntersectionObserver(
      ([entry]) => {
        const past = !entry.isIntersecting;
        if (past === this.pastHero) return;
        this.pastHero = past;
        this.cdr.markForCheck();
      },
      { threshold: 0 }
    );
    this.heroObserver.observe(hero);
  }
}
