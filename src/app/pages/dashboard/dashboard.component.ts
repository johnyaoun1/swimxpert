import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, Child } from '../../services/auth.service';
import { SwimLevelsService } from '../../services/swim-levels.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  user = this.authService.currentUser;
  showAddChildForm = signal(false);
  showProgressForm = signal(false);
  selectedChildId = signal<string | null>(null);
  levels = this.swimLevelsService.getLevels();

  childForm: FormGroup;
  progressForm: FormGroup;

  constructor(
    private authService: AuthService,
    private swimLevelsService: SwimLevelsService,
    private fb: FormBuilder,
    private router: Router
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
  }

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
    }
  }

  toggleAddChildForm(): void {
    this.showAddChildForm.set(!this.showAddChildForm());
    if (this.showAddChildForm()) {
      this.childForm.reset({ level: 1 });
    }
  }

  addChild(): void {
    if (this.childForm.valid) {
      const formValue = this.childForm.value;
      this.authService.addChild({
        name: formValue.name,
        age: formValue.age,
        level: formValue.level,
        profilePicture: formValue.profilePicture || undefined,
        progress: []
      });
      this.childForm.reset({ level: 1 });
      this.showAddChildForm.set(false);
    }
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
    if (this.progressForm.valid && this.selectedChildId()) {
      const formValue = this.progressForm.value;
      const skills = formValue.skills 
        ? formValue.skills.split(',').map((s: string) => s.trim()).filter((s: string) => s)
        : [];
      
      this.authService.addProgressEntry(this.selectedChildId()!, {
        date: formValue.date,
        level: formValue.level,
        notes: formValue.notes,
        skills: skills
      });

      const child = this.user()?.children.find(c => c.id === this.selectedChildId());
      if (child) {
        this.authService.updateChild(this.selectedChildId()!, { level: formValue.level });
      }

      this.closeProgressForm();
    }
  }

  handleImageError(event: Event, childName: string): void {
    const img = event.target as HTMLImageElement;
    const firstLetter = childName.charAt(0).toUpperCase();
    const svgData = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23e5e7eb' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='40'%3E${firstLetter}%3C/text%3E%3C/svg%3E`;
    img.src = svgData;
  }
}
