import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { LevelFinderService, LevelFinderResult } from '../../services/level-finder.service';
import { SwimLevelsService } from '../../services/swim-levels.service';
import { AuthService } from '../../services/auth.service';
import { SeoService } from '../../services/seo.service';

const LF_RESULT_KEY = 'lf_pending_result';

@Component({
  selector: 'app-level-finder',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './level-finder.component.html',
  styleUrls: ['./level-finder.component.scss']
})
export class LevelFinderComponent implements OnInit, OnDestroy {
  private querySub?: Subscription;
  levelFinderForm: FormGroup;
  showResult  = signal(false);
  loading     = signal(false);
  errorMessage = signal('');
  determinedLevel = signal<number>(1);
  levelInfo   = signal<any>(null);
  result      = signal<LevelFinderResult | null>(null);

  questions = [
    { id: 1,  key: 'q1',  text: 'Can your child float independently on their back?' },
    { id: 2,  key: 'q2',  text: 'Can your child kick on front and back with control?' },
    { id: 3,  key: 'q3',  text: 'Can your child swim 5–10 meters independently?' },
    { id: 4,  key: 'q4',  text: 'Can your child roll from front to back and swim back to the wall?' },
    { id: 5,  key: 'q5',  text: 'Can your child swim 10–15 meters continuously with some breath control?' },
    { id: 6,  key: 'q6',  text: 'Can your child swim freestyle with side breathing and coordinated arms?' },
    { id: 7,  key: 'q7',  text: 'Can your child swim backstroke with proper arm movement?' },
    { id: 8,  key: 'q8',  text: 'Can your child swim breaststroke with proper kick and glide?' },
    { id: 9,  key: 'q9',  text: 'Can your child swim 25 meters or more continuously?' },
    { id: 10, key: 'q10', text: 'Can your child tread water for 30–45 seconds?' },
    { id: 11, key: 'q11', text: 'Can your child perform a safe jump into the water and return to the wall?' },
    { id: 12, key: 'q12', text: 'Can your child perform flip turns or wall push-offs?' },
    { id: 13, key: 'q13', text: 'Can your child swim butterfly kick or full butterfly stroke?' }
  ];

  constructor(
    private fb: FormBuilder,
    private levelFinderService: LevelFinderService,
    private swimLevelsService: SwimLevelsService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private seo: SeoService
  ) {
    const formControls: any = {
      age: [null, [Validators.required, Validators.min(3), Validators.max(18)]]
    };
    this.questions.forEach(q => { formControls[q.key] = [null]; });
    this.levelFinderForm = this.fb.group(formControls);
  }

  ngOnInit(): void {
    this.seo.updatePage({
      title: 'Find Your Swimming Level | SwimXpert Lebanon',
      description:
        'Not sure which swimming class is right for you? Take our quick level assessment and find the perfect SwimXpert program in Lebanon.',
      path: '/level-finder'
    });

    this.querySub = this.route.queryParams.subscribe(params => {
      if (params['restore'] === '1') {
        this.tryRestoreResult();
      }
    });

    if (this.authService.isAuthenticatedSync() && !this.showResult()) {
      this.tryRestoreResult();
    }
  }

  ngOnDestroy(): void {
    this.querySub?.unsubscribe();
  }

  private tryRestoreResult(): void {
    try {
      const raw = localStorage.getItem(LF_RESULT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as LevelFinderResult & { determinedLevel: number };
        const num = saved.determinedLevel ?? this.levelFinderService.toLevelNumber(saved);
        this.result.set(saved);
        this.determinedLevel.set(num);
        this.levelInfo.set(this.swimLevelsService.getLevel(num));
        this.showResult.set(true);
        localStorage.removeItem(LF_RESULT_KEY);
      }
    } catch {
      localStorage.removeItem(LF_RESULT_KEY);
    }
  }

  onSubmit(): void {
    if (!this.levelFinderForm.valid) return;

    const formValue = this.levelFinderForm.value;

    const answers = this.questions.map(q => ({
      question: q.text,
      answer: this.convertToBoolean(formValue[q.key]) === true  ? 'Yes'
            : this.convertToBoolean(formValue[q.key]) === false ? 'No'
            : 'Not answered'
    }));

    this.loading.set(true);
    this.errorMessage.set('');

    this.levelFinderService.analyzeLevel({ age: formValue.age, answers }).subscribe({
      next: (res) => {
        const num = this.levelFinderService.toLevelNumber(res);
        this.result.set(res);
        this.determinedLevel.set(num);
        this.levelInfo.set(this.swimLevelsService.getLevel(num));
        this.loading.set(false);
        this.showResult.set(true);

        if (!this.authService.isAuthenticatedSync()) {
          localStorage.setItem(LF_RESULT_KEY, JSON.stringify({ ...res, determinedLevel: num }));
        }
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || err?.message || 'Assessment failed. Please try again.');
        this.loading.set(false);
      }
    });
  }

  private convertToBoolean(value: any): boolean | null {
    if (value === true  || value === 'true')  return true;
    if (value === false || value === 'false') return false;
    return null;
  }

  resetForm(): void {
    this.levelFinderForm.reset();
    this.showResult.set(false);
    this.loading.set(false);
    this.errorMessage.set('');
    this.result.set(null);
    this.determinedLevel.set(1);
    this.levelInfo.set(null);
  }

  get answeredCount(): number {
    return this.questions.filter(q => this.levelFinderForm.get(q.key)?.value !== null).length;
  }
}
