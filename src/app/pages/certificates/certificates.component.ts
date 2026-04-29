import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeUrlPipe } from '../../pipes/safe-url.pipe';
import { jsPDF } from 'jspdf';

interface Certificate {
  id: number;
  title: string;
  description: string;
  /** Path to the certificate file (JPG or PDF) */
  filePath: string;
  /** MIME type: 'image/jpeg' for JPG, 'application/pdf' for PDF */
  type: 'image' | 'pdf';
  thumbnail?: string;
  /** If true, the "CERTIFIED" badge is hidden (e.g. for invitation card) */
  hideCertifiedBadge?: boolean;
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
  showViewer = false;

  
  certificates: Certificate[] = [
    { id: 1, title: 'SwimXpert Certificate', description: 'Official SwimXpert swimming certificate.', filePath: 'assets/certificates/SWIM.jpg', type: 'image' },
    { id: 2, title: 'Intermediate — Girl', description: 'SwimXpert Intermediate certificate for girls. Independent buoyancy, glides, and simple strokes.', filePath: 'assets/certificates/intermediate-girl.jpg', type: 'image' },
    { id: 3, title: 'Intermediate — Boy', description: 'SwimXpert Intermediate certificate for boys. Independent buoyancy, glides, and simple strokes.', filePath: 'assets/certificates/intermediate-boy.jpg', type: 'image' },
    { id: 4, title: 'Advanced — Girl', description: 'SwimXpert Advanced certificate for girls. Coordinated strokes, stamina, and refined technique.', filePath: 'assets/certificates/advanced-girl.jpg', type: 'image' },
    { id: 5, title: 'Advanced — Boy', description: 'SwimXpert Advanced certificate for boys. Coordinated strokes, stamina, and refined technique.', filePath: 'assets/certificates/advanced-boy.jpg', type: 'image' }
  ];

  viewCertificate(certificate: Certificate): void {
    this.selectedCertificate = certificate;
    this.showViewer = true;
  }

  closeViewer(): void {
    this.showViewer = false;
    this.selectedCertificate = null;
  }

  downloadCertificate(certificate: Certificate, event: Event): void {
    event.stopPropagation();
    if (certificate.type === 'pdf') {
      const a = document.createElement('a');
      a.href = certificate.filePath;
      a.download = certificate.title.replace(/[^a-zA-Z0-9-]/g, '-') + '.pdf';
      a.click();
      return;
    }
    // Convert image to PDF and download
    const img = new Image();
    img.onload = () => {
      const pdf = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait', unit: 'mm', format: [img.width * 0.26458, img.height * 0.26458] });
      pdf.addImage(img, 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      pdf.save(certificate.title.replace(/[^a-zA-Z0-9-]/g, '-') + '.pdf');
    };
    img.onerror = () => {
      const a = document.createElement('a');
      a.href = certificate.filePath;
      a.download = certificate.title.replace(/[^a-zA-Z0-9-]/g, '-') + '.jpg';
      a.click();
    };
    img.src = certificate.filePath;
  }
}
