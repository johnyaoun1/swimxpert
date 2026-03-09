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
      src: 'https://placehold.co/600x400/4A8FA8/ffffff?text=SwimXpert',
      alt: 'Swimming training session',
      title: 'Beginner Lessons'
    },
    {
      id: 2,
      src: 'https://placehold.co/600x400/2C6478/ffffff?text=SwimXpert',
      alt: 'Pool training',
      title: 'Advanced Training'
    },
    {
      id: 3,
      src: 'https://placehold.co/600x400/6DB8CC/ffffff?text=SwimXpert',
      alt: 'Swim lesson',
      title: 'Fun Activities'
    },
    {
      id: 4,
      src: 'https://placehold.co/600x400/4A8FA8/ffffff?text=SwimXpert',
      alt: 'Coaching session',
      title: 'Personalized Instruction'
    },
    {
      id: 5,
      src: 'https://placehold.co/600x400/2C6478/ffffff?text=SwimXpert',
      alt: 'Group class',
      title: 'Our Facilities'
    },
    {
      id: 6,
      src: 'https://placehold.co/600x400/6DB8CC/ffffff?text=SwimXpert',
      alt: 'Advanced training',
      title: 'Achievement Celebration'
    },
    {
      id: 7,
      src: 'https://placehold.co/600x400/4A8FA8/ffffff?text=SwimXpert',
      alt: 'Beginner lesson',
      title: 'Group Lessons'
    },
    {
      id: 8,
      src: 'https://placehold.co/600x400/2C6478/ffffff?text=SwimXpert',
      alt: 'Competition prep',
      title: 'Safety Training'
    },
    {
      id: 9,
      src: 'https://placehold.co/600x400/6DB8CC/ffffff?text=SwimXpert',
      alt: 'Team training',
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
