import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  constructor(private seo: SeoService) {}

  ngOnInit(): void {
    this.seo.updatePage({
      title: 'SwimXpert | Swimming Lessons & Coaching in Lebanon',
      description:
        'SwimXpert provides professional swimming lessons for children and adults across Lebanon. Expert coaches, beginner to advanced programs, and private sessions available.',
      path: '/',
      keywords:
        'swimming lessons lebanon, swimming classes beirut, kids swimming lessons, private swimming coach lebanon'
    });
  }
}
