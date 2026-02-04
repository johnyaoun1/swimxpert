import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LevelFinderService, LevelFinderAnswers } from '../../services/level-finder.service';
import { SwimLevelsService } from '../../services/swim-levels.service';

@Component({
  selector: 'app-level-finder',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './level-finder.component.html',
  styleUrls: ['./level-finder.component.scss']
})
export class LevelFinderComponent {
  levelFinderForm: FormGroup;
  showResult = signal(false);
  determinedLevel = signal<number>(1);
  levelInfo = signal<any>(null);

  questions = [
    { id: 1, key: 'q1', text: 'Can your child float independently on their back?' },
    { id: 2, key: 'q2', text: 'Can your child kick on front and back with control?' },
    { id: 3, key: 'q3', text: 'Can your child swim 5–10 meters independently?' },
    { id: 4, key: 'q4', text: 'Can your child roll from front to back and swim back to the wall?' },
    { id: 5, key: 'q5', text: 'Can your child swim 10–15 meters continuously with some breath control?' },
    { id: 6, key: 'q6', text: 'Can your child swim freestyle with side breathing and coordinated arms?' },
    { id: 7, key: 'q7', text: 'Can your child swim backstroke with proper arm movement?' },
    { id: 8, key: 'q8', text: 'Can your child swim breaststroke with proper kick and glide?' },
    { id: 9, key: 'q9', text: 'Can your child swim 25 meters or more continuously?' },
    { id: 10, key: 'q10', text: 'Can your child tread water for 30–45 seconds?' },
    { id: 11, key: 'q11', text: 'Can your child perform a safe jump into the water and return to the wall?' },
    { id: 12, key: 'q12', text: 'Can your child perform flip turns or wall push-offs?' },
    { id: 13, key: 'q13', text: 'Can your child swim butterfly kick or full butterfly stroke?' }
  ];

  constructor(
    private fb: FormBuilder,
    private levelFinderService: LevelFinderService,
    private swimLevelsService: SwimLevelsService
  ) {
    const formControls: any = {
      age: [null, [Validators.required, Validators.min(3), Validators.max(18)]]
    };

    this.questions.forEach(q => {
      formControls[q.key] = [null];
    });

    this.levelFinderForm = this.fb.group(formControls);
  }

  onSubmit(): void {
    if (this.levelFinderForm.valid) {
      const formValue = this.levelFinderForm.value;
      const answers: LevelFinderAnswers = {
        age: formValue.age,
        q1: this.convertToBoolean(formValue.q1),
        q2: this.convertToBoolean(formValue.q2),
        q3: this.convertToBoolean(formValue.q3),
        q4: this.convertToBoolean(formValue.q4),
        q5: this.convertToBoolean(formValue.q5),
        q6: this.convertToBoolean(formValue.q6),
        q7: this.convertToBoolean(formValue.q7),
        q8: this.convertToBoolean(formValue.q8),
        q9: this.convertToBoolean(formValue.q9),
        q10: this.convertToBoolean(formValue.q10),
        q11: this.convertToBoolean(formValue.q11),
        q12: this.convertToBoolean(formValue.q12),
        q13: this.convertToBoolean(formValue.q13)
      };

      const level = this.levelFinderService.determineLevel(answers);
      this.determinedLevel.set(level);
      this.levelInfo.set(this.swimLevelsService.getLevel(level));
      this.showResult.set(true);
    }
  }

  private convertToBoolean(value: any): boolean | null {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return null;
  }

  resetForm(): void {
    this.levelFinderForm.reset();
    this.showResult.set(false);
    this.determinedLevel.set(1);
    this.levelInfo.set(null);
  }
}
