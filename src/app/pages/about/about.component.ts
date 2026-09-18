import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {
  constructor(private seo: SeoService) {}

  ngOnInit(): void {
    this.seo.updatePage({
      title: 'About SwimXpert | Professional Swimming Coaches Lebanon',
      description:
        "SwimXpert coaches hold ASCA Levels 1–3, SAS swimming diploma, and Ministry of Tourism lifeguard certification. Private lessons from 2.5 years, semi-private groups, aqua therapy, and aqua gym in Lebanon.",
      path: '/about'
    });
  }
}
