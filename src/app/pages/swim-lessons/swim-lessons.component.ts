import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SwimLevelsService } from '../../services/swim-levels.service';

@Component({
  selector: 'app-swim-lessons',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './swim-lessons.component.html',
  styleUrls: ['./swim-lessons.component.scss']
})
export class SwimLessonsComponent {
  levels = this.swimLevelsService.getLevels();

  constructor(private swimLevelsService: SwimLevelsService) {}
}
