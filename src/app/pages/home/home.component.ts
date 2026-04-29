import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  constructor(private title: Title, private meta: Meta) {}

  ngOnInit(): void {
    this.title.setTitle('SwimXpert | Swimming Lessons & Coaching in Lebanon');
    this.meta.updateTag({
      name: 'description',
      content: 'SwimXpert provides professional swimming lessons for children and adults across Lebanon. Expert coaches, beginner to advanced programs, and private sessions available.'
    });
  }
}
