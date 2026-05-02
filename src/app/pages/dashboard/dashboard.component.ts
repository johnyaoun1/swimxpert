import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { AuthService, Child } from '../../services/auth.service';
import { SwimLevelsService } from '../../services/swim-levels.service';
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
  showAddChildForm = signal(false);
  showProgressForm = signal(false);
  showEditChildForm = signal(false);
  selectedChildId = signal<string | null>(null);
  selectedChildForProfile = signal<Child | null>(null);
  selectedChildForEdit = signal<Child | null>(null);
  levels = this.swimLevelsService.getLevels();

  childForm: FormGroup;
  progressForm: FormGroup;
  editChildForm: FormGroup;

  constructor(
    private authService: AuthService,
    private swimLevelsService: SwimLevelsService,
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
      this.authService.syncChildrenFromApi().subscribe();
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
        this.authService.syncChildrenFromApi().subscribe();
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

  handleImageError(event: Event, childName: string): void {
    const img = event.target as HTMLImageElement;
    const firstLetter = childName.charAt(0).toUpperCase();
    const svgData = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23e5e7eb' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='40'%3E${firstLetter}%3C/text%3E%3C/svg%3E`;
    img.src = svgData;
  }

  openChildProfile(child: Child): void {
    this.selectedChildForProfile.set(child);
  }

  closeChildProfile(): void {
    this.selectedChildForProfile.set(null);
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
      },
      error: (err) => {
        this.editChildError.set(err?.message || 'Failed to update profile.');
      }
    });
  }

  getLevelFocus = getLevelFocus;
  getChildInitial = getChildInitial;
}
