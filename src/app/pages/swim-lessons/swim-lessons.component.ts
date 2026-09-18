import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SwimLevelsService } from '../../services/swim-levels.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-swim-lessons',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './swim-lessons.component.html',
  styleUrls: ['./swim-lessons.component.scss']
})
export class SwimLessonsComponent implements OnInit {
  levels = this.swimLevelsService.getLevels();

  constructor(
    private swimLevelsService: SwimLevelsService,
    private seo: SeoService
  ) {}

  ngOnInit(): void {
    this.seo.updatePage({
      title: 'Swimming Lessons Lebanon | All Levels | SwimXpert',
      description:
        'Explore SwimXpert swimming programs for all skill levels in Lebanon. Beginner, intermediate and advanced classes with certified coaches.',
      path: '/swim-lessons'
    });
  }
}
