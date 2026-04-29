import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {
  constructor(private title: Title, private meta: Meta) {}

  ngOnInit(): void {
    this.title.setTitle('About SwimXpert | Professional Swimming Coaches Lebanon');
    this.meta.updateTag({
      name: 'description',
      content: "Learn about SwimXpert's mission to bring professional swimming coaching to Lebanon. Meet our certified instructors and discover our training philosophy."
    });
  }
}
