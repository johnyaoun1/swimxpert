import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Turns a stored profile-photo path into an img src.
 * Only the authorized API path, a blob preview, or a data URL is rendered.
 */
@Pipe({
  name: 'profileSrc',
  standalone: true
})
export class ProfileSrcPipe implements PipeTransform {
  transform(value: string | null | undefined): string | null {
    if (!value) return null;
    if (value.startsWith('blob:') || value.startsWith('data:')) return value;
    if (!value.startsWith('/api/profile-pictures/')) return null;

    if (environment.apiUrl.startsWith('http')) {
      const origin = environment.apiUrl.replace(/\/api\/?$/, '');
      return origin + value;
    }

    return value;
  }
}
