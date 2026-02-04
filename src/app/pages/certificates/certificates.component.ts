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
    {
      id: 1,
      title: 'Swimming Instructor Certification',
      description: 'Certified swimming instructor with advanced training in water safety and stroke technique.',
      pdfPath: '/assets/certificates/certificate-1.pdf',
      thumbnail: '/assets/certificates/thumb-1.jpg'
    },
    {
      id: 2,
      title: 'Lifeguard Certification',
      description: 'Professional lifeguard certification ensuring the highest standards of water safety.',
      pdfPath: '/assets/certificates/certificate-2.pdf',
      thumbnail: '/assets/certificates/thumb-2.jpg'
    },
    {
      id: 3,
      title: 'Water Safety Instructor',
      description: 'Advanced certification in teaching water safety and survival skills to all age groups.',
      pdfPath: '/assets/certificates/certificate-3.pdf',
      thumbnail: '/assets/certificates/thumb-3.jpg'
    },
    {
      id: 4,
      title: 'Competitive Swimming Coach',
      description: 'Elite level coaching certification for competitive swimming programs.',
      pdfPath: '/assets/certificates/certificate-4.pdf',
      thumbnail: '/assets/certificates/thumb-4.jpg'
    }
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
