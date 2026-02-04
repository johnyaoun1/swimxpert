import { Injectable } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  constructor(
    private title: Title,
    private meta: Meta
  ) {}

  updateTitle(title: string): void {
    this.title.setTitle(title);
  }

  updateDescription(description: string): void {
    this.meta.updateTag({ name: 'description', content: description });
  }

  updateKeywords(keywords: string): void {
    this.meta.updateTag({ name: 'keywords', content: keywords });
  }

  updateMetaTags(title: string, description: string, keywords?: string): void {
    this.updateTitle(title);
    this.updateDescription(description);
    if (keywords) {
      this.updateKeywords(keywords);
    }
  }
}
