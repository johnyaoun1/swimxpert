import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { AuthService, Child } from '../../services/auth.service';
import { SwimLevelsService } from '../../services/swim-levels.service';
import { AttendanceService, Attendance } from '../../services/attendance.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ProfilePictureUploadComponent } from '../../shared/profile-picture-upload/profile-picture-upload.component';
import { getLevelFocus, getChildInitial } from '../../utils/swim-utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, ProfilePictureUploadComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  user = this.authService.currentUser;
  pendingSessions = signal<Attendance[]>([]);
  readonly registrationsByChildId = signal<Record<string, Attendance[]>>({});
  /** Accordion open levels keyed by child id */
  readonly expandedLevelsByChildId = signal<Record<string, Set<number>>>({});
  readonly ringRadii = { outer: 46, mid: 37, inner: 28 };
  showAddChildForm = signal(false);
  showProgressForm = signal(false);
  showEditChildForm = signal(false);
  selectedChildId = signal<string | null>(null);
  selectedChildForEdit = signal<Child | null>(null);
  levels = this.swimLevelsService.getLevels();

  childForm: FormGroup;
  progressForm: FormGroup;
  editChildForm: FormGroup;

  constructor(
    private authService: AuthService,
    private swimLevelsService: SwimLevelsService,
    private attendanceService: AttendanceService,
    private fb: FormBuilder,
    private router: Router,
    private title: Title,
    private meta: Meta
  ) {
    this.childForm = this.fb.group({
      name: ['', Validators.required],
      age: [null, [Validators.required, Validators.min(3), Validators.max(18)]],
      level: [1, Validators.required],
      profilePicture: ['']
    });

    this.progressForm = this.fb.group({
      level: [1, Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      notes: ['', Validators.required],
      skills: ['']
    });

    this.editChildForm = this.fb.group({
      name: ['', Validators.required],
      age: [null, [Validators.required, Validators.min(3), Validators.max(18)]],
      level: [1, Validators.required],
      profilePicture: ['']
    });
  }

  editChildError = signal<string | null>(null);

  ngOnInit(): void {
    this.title.setTitle('My Dashboard | SwimXpert');
    this.meta.updateTag({
      name: 'description',
      content: 'Manage your SwimXpert account, view your swimmers progress, and track upcoming sessions.'
    });
    this.authService.isAuthenticated().subscribe((isAuthenticated) => {
      if (!isAuthenticated) {
        this.router.navigate(['/login']);
        return;
      }
      this.authService.syncChildrenFromApi().subscribe({
        next: () => {
          this.loadPendingSessions();
          this.loadSessionsForInProgressChildren();
        }
      });
    });
  }

  toggleAddChildForm(): void {
    this.showAddChildForm.set(!this.showAddChildForm());
    if (this.showAddChildForm()) {
      this.childForm.reset({ level: 1 });
    }
  }

  addChildError = signal<string | null>(null);

  addChild(): void {
    this.addChildError.set(null);
    if (!this.childForm.valid) return;
    const formValue = this.childForm.value;
    this.authService.addChild({
      name: formValue.name,
      age: formValue.age,
      level: formValue.level,
      profilePicture: formValue.profilePicture || undefined,
      progress: []
    }).subscribe({
      next: () => {
        this.childForm.reset({ level: 1 });
        this.showAddChildForm.set(false);
        this.authService.syncChildrenFromApi().subscribe({
          next: () => this.loadSessionsForInProgressChildren()
        });
      },
      error: (err) => {
        this.addChildError.set(err?.message || 'Failed to add child. Please try again.');
      }
    });
  }

  showAddProgress(childId: string): void {
    this.selectedChildId.set(childId);
    const child = this.user()?.children.find(c => c.id === childId);
    if (child) {
      this.progressForm.patchValue({ level: child.level });
    }
    this.showProgressForm.set(true);
  }

  closeProgressForm(): void {
    this.showProgressForm.set(false);
    this.selectedChildId.set(null);
    this.progressForm.reset({
      level: 1,
      date: new Date().toISOString().split('T')[0],
      notes: '',
      skills: ''
    });
  }

  addProgress(): void {
    if (!this.progressForm.valid || !this.selectedChildId()) return;
    const formValue = this.progressForm.value;
    const skills = formValue.skills
      ? formValue.skills.split(',').map((s: string) => s.trim()).filter((s: string) => s)
      : [];

    this.authService.addProgressEntry(this.selectedChildId()!, {
      date: formValue.date,
      level: formValue.level,
      notes: formValue.notes,
      skills
    }).subscribe({
      next: () => this.closeProgressForm(),
      error: () => this.closeProgressForm()
    });
  }

  private loadSessionsForInProgressChildren(): void {
    const kids = this.filteredChildren();
    if (!kids.length) {
      this.registrationsByChildId.set({});
      return;
    }
    const now = new Date();
    const reqs = kids.map((c) =>
      this.attendanceService.getMySessions(c.id).pipe(
        catchError(() => of([] as Attendance[])),
        map((rows) => ({
          id: c.id,
          rows: rows.filter((r) => new Date(r.date) >= now)
        }))
      )
    );
    forkJoin(reqs).subscribe({
      next: (results) => {
        const map: Record<string, Attendance[]> = {};
        for (const r of results) map[r.id] = r.rows;
        this.registrationsByChildId.set(map);
      },
      error: () => {}
    });
  }

  /** In-progress swimmers only (Level &lt; 4). */
  filteredChildren(): Child[] {
    const kids = this.user()?.children ?? [];
    return kids.filter((c) => (c.level ?? 1) < 4);
  }

  gradientIdSafe(childId: string): string {
    return childId.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  sessionsForChild(childId: string): Attendance[] {
    return this.registrationsByChildId()[childId] ?? [];
  }

  toggleSection(childId: string, level: number): void {
    const prev = this.expandedLevelsByChildId();
    const set = new Set(prev[childId] ?? []);
    if (set.has(level)) set.delete(level);
    else set.add(level);
    this.expandedLevelsByChildId.set({ ...prev, [childId]: set });
  }

  sectionExpanded(childId: string, level: number): boolean {
    return this.expandedLevelsByChildId()[childId]?.has(level) ?? false;
  }

  ringDash(pct: number, r: number): string {
    const c = 2 * Math.PI * r;
    const p = Math.min(100, Math.max(0, pct)) / 100;
    return `${p * c} ${c}`;
  }

  ringStats(child: Child): { beginner: number; intermediate: number; advanced: number } {
    const blocks = child.skillLevels ?? [];
    let begSum = 0;
    let begN = 0;
    let inter = 0;
    let adv = 0;
    for (const b of blocks) {
      if (b.level <= 2) {
        begSum += b.completionPercent;
        begN++;
      } else if (b.level === 3) {
        inter = b.completionPercent;
      } else if (b.level >= 4) {
        adv = Math.max(adv, b.completionPercent);
      }
    }
    return {
      beginner: begN ? Math.round(begSum / begN) : 0,
      intermediate: inter,
      advanced: adv
    };
  }

  sectionHeading(level: number): string {
    if (level <= 2) return 'Beginner skills';
    if (level === 3) return 'Intermediate skills';
    return 'Advanced skills';
  }

  headerTone(level: number): 'beginner' | 'intermediate' | 'advanced' {
    if (level <= 2) return 'beginner';
    if (level === 3) return 'intermediate';
    return 'advanced';
  }

  levelBadgeClass(level: number): string {
    if (level <= 2) return 'aqua-badge aqua-badge--beginner';
    if (level === 3) return 'aqua-badge aqua-badge--intermediate';
    if (level === 4) return 'aqua-badge aqua-badge--advanced';
    return 'aqua-badge aqua-badge--elite';
  }

  levelFocus(child: Child): string {
    return getLevelFocus(child.level);
  }

  cancelRegistration(childId: string, registrationId: string): void {
    this.attendanceService.cancelRegistration(registrationId).subscribe({
      next: () => {
        const prev = this.registrationsByChildId();
        const list = prev[childId] ?? [];
        this.registrationsByChildId.set({
          ...prev,
          [childId]: list.filter((r) => r.id !== registrationId)
        });
      },
      error: () => {}
    });
  }

  handleImageError(event: Event, childName: string): void {
    const img = event.target as HTMLImageElement;
    const firstLetter = childName.charAt(0).toUpperCase();
    const svgData = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23e5e7eb' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='40'%3E${firstLetter}%3C/text%3E%3C/svg%3E`;
    img.src = svgData;
  }

  openEditChildProfile(child: Child): void {
    this.selectedChildForEdit.set(child);
    this.editChildForm.patchValue({
      name: child.name,
      age: child.age,
      level: child.level,
      profilePicture: child.profilePicture || ''
    });
    this.editChildError.set(null);
    this.showEditChildForm.set(true);
  }

  closeEditChildForm(): void {
    this.showEditChildForm.set(false);
    this.selectedChildForEdit.set(null);
    this.editChildError.set(null);
  }

  saveEditChild(): void {
    const child = this.selectedChildForEdit();
    if (!child || !this.editChildForm.valid) return;
    this.editChildError.set(null);
    const v = this.editChildForm.value;
    this.authService.updateChildApi(child.id, {
      name: v.name,
      age: v.age,
      level: v.level,
      profilePicture: v.profilePicture || null
    }).subscribe({
      next: () => {
        this.closeEditChildForm();
        this.loadSessionsForInProgressChildren();
      },
      error: (err) => {
        this.editChildError.set(err?.message || 'Failed to update profile.');
      }
    });
  }

  private loadPendingSessions(): void {
    const children = this.authService.getCurrentUser()?.children ?? [];
    if (children.length === 0) return;
    const reqs = children.map((c) =>
      this.attendanceService.getMySessions(c.id).pipe(catchError(() => of([] as Attendance[])))
    );
    forkJoin(reqs).subscribe({
      next: (results) => {
        const pending = results.flat().filter((a) => a.bookingStatus === 'Pending');
        this.pendingSessions.set(pending);
      },
      error: () => {}
    });
  }

  getChildInitial = getChildInitial;
}
