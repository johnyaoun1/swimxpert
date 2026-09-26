import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';

export interface SeoPageOptions {
  title: string;
  description: string;
  /** Site path, e.g. `/about` or `/` */
  path: string;
  keywords?: string;
  /** Defaults to `index, follow`. The 404 page sets `noindex, follow`. */
  robots?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private readonly siteOrigin = 'https://swimxpert.com';
  private jsonLdScripts = new Map<string, HTMLScriptElement>();

  constructor(
    private title: Title,
    private meta: Meta,
    @Inject(DOCUMENT) private document: Document
  ) {}

  /** Absolute canonical URL for a path (`/` → https://swimxpert.com). */
  canonicalUrl(path: string): string {
    if (!path || path === '/') {
      return this.siteOrigin;
    }
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${this.siteOrigin}${normalized}`;
  }

  updateTitle(title: string): void {
    this.title.setTitle(title);
  }

  updateDescription(description: string): void {
    this.meta.updateTag({ name: 'description', content: description });
  }

  updateKeywords(keywords: string): void {
    this.meta.updateTag({ name: 'keywords', content: keywords });
  }

  updateCanonical(url: string): void {
    let link = this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  updateOpenGraph(title: string, description: string, url: string): void {
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });
  }

  updateTwitter(title: string, description: string): void {
    this.meta.updateTag({ property: 'twitter:title', content: title });
    this.meta.updateTag({ property: 'twitter:description', content: description });
    // Also set name= variants used by some crawlers
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
  }

  /**
   * Sets title, description, canonical, Open Graph, and Twitter tags for a page.
   */
  updatePage(options: SeoPageOptions): void {
    const url = this.canonicalUrl(options.path);
    this.updateTitle(options.title);
    this.updateDescription(options.description);
    this.updateCanonical(url);
    this.updateOpenGraph(options.title, options.description, url);
    this.updateTwitter(options.title, options.description);
    if (options.keywords) {
      this.updateKeywords(options.keywords);
    }
    // Reset on every page, or a noindex set by the 404 would follow the
    // visitor onto the next route they open.
    this.meta.updateTag({ name: 'robots', content: options.robots ?? 'index, follow' });
  }

  /** @deprecated Prefer updatePage() */
  updateMetaTags(title: string, description: string, keywords?: string): void {
    this.updateTitle(title);
    this.updateDescription(description);
    if (keywords) {
      this.updateKeywords(keywords);
    }
  }

  /**
   * Injects (or replaces) a JSON-LD script in <head>. Use a stable id so re-navigation
   * and SSR cleanup stay predictable.
   */
  setJsonLd(id: string, data: Record<string, unknown> | object): void {
    this.removeJsonLd(id);
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(data);
    this.document.head.appendChild(script);
    this.jsonLdScripts.set(id, script);
  }

  removeJsonLd(id: string): void {
    const existing = this.jsonLdScripts.get(id) ?? this.document.getElementById(id);
    if (existing?.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    this.jsonLdScripts.delete(id);
  }
}
