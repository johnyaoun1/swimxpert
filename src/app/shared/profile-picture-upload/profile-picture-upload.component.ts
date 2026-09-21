import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { ProfileSrcPipe } from '../../pipes/profile-src.pipe';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-profile-picture-upload',
  standalone: true,
  imports: [CommonModule, ProfileSrcPipe],
  templateUrl: './profile-picture-upload.component.html',
  styleUrls: ['./profile-picture-upload.component.scss']
})
export class ProfilePictureUploadComponent implements OnDestroy {
  @Input() currentPreview: string | null = null;
  @Input() placeholderLabel = 'Choose photo';
  @Input() disabled = false;

  @Output() urlChange = new EventEmitter<string | null>();

  uploading = false;
  errorMessage = '';
  /** Local preview. The authorized URL 404s until the swimmer row points at the file. */
  localPreview: string | null = null;
  previewBroken = false;

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

  ngOnDestroy(): void {
    this.revokeLocalPreview();
  }

  removePhoto(): void {
    this.revokeLocalPreview();
    this.previewBroken = false;
    this.urlChange.emit(null);
  }

  markPreviewBroken(): void {
    this.previewBroken = true;
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
    this.revokeLocalPreview();
    this.previewBroken = false;
    this.localPreview = URL.createObjectURL(file);
    this.uploading = true;
    this.apiService.uploadProfilePicture(file).subscribe({
      next: (res) => {
        this.urlChange.emit(res.url);
        this.uploading = false;
      },
      error: (err) => {
        this.revokeLocalPreview();
        this.errorMessage = err?.message || 'Upload failed. Try again.';
        this.uploading = false;
      }
    });
  }

  private revokeLocalPreview(): void {
    if (!this.localPreview) return;
    URL.revokeObjectURL(this.localPreview);
    this.localPreview = null;
  }
}
