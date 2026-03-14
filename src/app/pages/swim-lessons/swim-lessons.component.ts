import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { SwimLevelsService } from '../../services/swim-levels.service';

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
    private title: Title,
    private meta: Meta
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Swimming Lessons Lebanon | All Levels | SwimXpert');
    this.meta.updateTag({
      name: 'description',
      content: 'Explore SwimXpert swimming programs for all skill levels in Lebanon. Beginner, intermediate and advanced classes with certified coaches.'
    });
  }
}
