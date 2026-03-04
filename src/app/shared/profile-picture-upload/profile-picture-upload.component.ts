import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-profile-picture-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-picture-upload.component.html',
  styleUrls: ['./profile-picture-upload.component.scss']
})
export class ProfilePictureUploadComponent {
  @Input() currentPreview: string | null = null;
  @Input() placeholderLabel = 'Choose photo';
  @Input() disabled = false;

  @Output() urlChange = new EventEmitter<string | null>();

  uploading = false;
  errorMessage = '';

  constructor(private apiService: ApiService) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.upload(file);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled || this.uploading) return;
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) this.upload(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  removePhoto(): void {
    this.urlChange.emit(null);
  }

  triggerFileInput(input: HTMLInputElement): void {
    if (!this.disabled && !this.uploading) input.click();
  }

  private upload(file: File): void {
    this.errorMessage = '';
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.errorMessage = 'File must be 5 MB or smaller.';
      return;
    }
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      this.errorMessage = 'Use JPG, PNG, GIF or WebP.';
      return;
    }
    this.uploading = true;
    this.apiService.uploadProfilePicture(file).subscribe({
      next: (res) => {
        this.urlChange.emit(res.url);
        this.uploading = false;
      },
      error: (err) => {
        this.errorMessage = err?.message || 'Upload failed. Try again.';
        this.uploading = false;
      }
    });
  }
}
