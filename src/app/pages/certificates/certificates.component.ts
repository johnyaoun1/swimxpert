import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeUrlPipe } from '../../pipes/safe-url.pipe';

interface Certificate {
  id: number;
  title: string;
  description: string;
  pdfPath: string;
  thumbnail?: string;
}

@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [CommonModule, SafeUrlPipe],
  templateUrl: './certificates.component.html',
  styleUrls: ['./certificates.component.scss']
})
export class CertificatesComponent {
  selectedCertificate = null as Certificate | null;
  showPdfViewer = false;

  certificates: Certificate[] = [
    { id: 1, title: 'Beginner — Girl', description: 'SwimXpert Beginner certificate for girls. Water comfort, basic floats, and introductory skills.', pdfPath: '/assets/certificates/beginner-girl.pdf', thumbnail: '/assets/certificates/thumb-beginner-girl.jpg' },
    { id: 2, title: 'Beginner — Boy', description: 'SwimXpert Beginner certificate for boys. Water comfort, basic floats, and introductory skills.', pdfPath: '/assets/certificates/beginner-boy.pdf', thumbnail: '/assets/certificates/thumb-beginner-boy.jpg' },
    { id: 3, title: 'Intermediate — Girl', description: 'SwimXpert Intermediate certificate for girls. Independent buoyancy, glides, and simple strokes.', pdfPath: '/assets/certificates/intermediate-girl.pdf', thumbnail: '/assets/certificates/thumb-intermediate-girl.jpg' },
    { id: 4, title: 'Intermediate — Boy', description: 'SwimXpert Intermediate certificate for boys. Independent buoyancy, glides, and simple strokes.', pdfPath: '/assets/certificates/intermediate-boy.pdf', thumbnail: '/assets/certificates/thumb-intermediate-boy.jpg' },
    { id: 5, title: 'Advanced — Girl', description: 'SwimXpert Advanced certificate for girls. Coordinated strokes, stamina, and refined technique.', pdfPath: '/assets/certificates/advanced-girl.pdf', thumbnail: '/assets/certificates/thumb-advanced-girl.jpg' },
    { id: 6, title: 'Advanced — Boy', description: 'SwimXpert Advanced certificate for boys. Coordinated strokes, stamina, and refined technique.', pdfPath: '/assets/certificates/advanced-boy.pdf', thumbnail: '/assets/certificates/thumb-advanced-boy.jpg' }
  ];

  viewCertificate(certificate: Certificate): void {
    this.selectedCertificate = certificate;
    this.showPdfViewer = true;
  }

  closePdfViewer(): void {
    this.showPdfViewer = false;
    this.selectedCertificate = null;
  }

  downloadCertificate(certificate: Certificate, event: Event): void {
    event.stopPropagation();
    // In a real application, this would trigger a download
    window.open(certificate.pdfPath, '_blank');
  }
}
