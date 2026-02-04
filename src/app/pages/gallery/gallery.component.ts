import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface GalleryImage {
  id: number;
  src: string;
  alt: string;
  title: string;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.scss']
})
export class GalleryComponent {
  selectedImage = signal<GalleryImage | null>(null);

  images: GalleryImage[] = [
    {
      id: 1,
      src: '',
      alt: 'Students learning basic swimming techniques',
      title: 'Beginner Lessons'
    },
    {
      id: 2,
      src: '',
      alt: 'Advanced swimmers practicing competitive strokes',
      title: 'Advanced Training'
    },
    {
      id: 3,
      src: '',
      alt: 'Fun water activities and games',
      title: 'Fun Activities'
    },
    {
      id: 4,
      src: '',
      alt: 'Instructors working one-on-one with students',
      title: 'Personalized Instruction'
    },
    {
      id: 5,
      src: '',
      alt: 'Modern pool facilities',
      title: 'Our Facilities'
    },
    {
      id: 6,
      src: '',
      alt: 'Students celebrating their achievements',
      title: 'Achievement Celebration'
    },
    {
      id: 7,
      src: '',
      alt: 'Group lessons in progress',
      title: 'Group Lessons'
    },
    {
      id: 8,
      src: '',
      alt: 'Water safety training session',
      title: 'Safety Training'
    },
    {
      id: 9,
      src: '',
      alt: 'Students practicing different strokes',
      title: 'Stroke Practice'
    }
  ];

  selectImage(image: GalleryImage): void {
    this.selectedImage.set(image);
  }

  closeImage(): void {
    this.selectedImage.set(null);
  }
}
