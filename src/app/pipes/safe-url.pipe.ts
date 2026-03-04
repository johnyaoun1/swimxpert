import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/** Only use for trusted asset URLs (e.g. assets/certificates/*). Avoid user-controlled URLs. */
@Pipe({
  name: 'safeUrl',
  standalone: true
})
export class SafeUrlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(url: string): SafeResourceUrl {
    if (!url || typeof url !== 'string') {
      return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    }
    const trimmed = url.trim();
    if (!trimmed.startsWith('assets/') && !trimmed.startsWith('/assets/')) {
      return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(trimmed);
  }
}
