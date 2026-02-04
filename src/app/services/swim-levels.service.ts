import { Injectable } from '@angular/core';

export interface SwimLevel {
  level: number;
  title: string;
  goal: string;
  requirements: string[];
  skillFocus: string[];
  duration: string;
}

@Injectable({
  providedIn: 'root'
})
export class SwimLevelsService {
  getLevels(): SwimLevel[] {
    return [
      {
        level: 1,
        title: 'Early Swim Lessons',
        goal: 'Build water comfort and confidence',
        requirements: ['None (all children 3+ start here)'],
        skillFocus: [
          'Water adaptation',
          'Blowing bubbles / putting face in water',
          'Assisted floating',
          'Moving a short distance with support'
        ],
        duration: '45 minutes'
      },
      {
        level: 2,
        title: 'Beginner Swim Lessons',
        goal: 'Develop independent buoyancy and simple movement',
        requirements: [
          'Can float independently (front/back)',
          'Can kick with control'
        ],
        skillFocus: [
          'Independent floating',
          'Controlled kicking on front/back',
          'Submerging face with breath control'
        ],
        duration: '45 minutes'
      },
      {
        level: 3,
        title: 'Beginner‑Intermediate Swim Lessons',
        goal: 'Begin independent swimming with coordination',
        requirements: [
          'Swim 5–10 meters independently',
          'Can roll front to back'
        ],
        skillFocus: [
          'Freestyle kick + body position',
          'Backstroke kick',
          'Rolling and returning to wall'
        ],
        duration: '45 minutes'
      },
      {
        level: 4,
        title: 'Intermediate Swim Lessons',
        goal: 'Build coordinated strokes and stamina',
        requirements: [
          'Swim 10–15 meters continuously',
          'Demonstrates breath coordination'
        ],
        skillFocus: [
          'Rhythmic freestyle with breathing',
          'Backstroke with arm movement',
          'Intro breaststroke',
          'Treading water (~20–30 sec)'
        ],
        duration: '45 minutes'
      },
      {
        level: 5,
        title: 'Advanced Swim Lessons',
        goal: 'Refine strokes and increase endurance',
        requirements: [
          'Swim 25+ meters continuously',
          'Controlled breathing during strokes'
        ],
        skillFocus: [
          'Freestyle with side breathing',
          'Backstroke proficiency',
          'Breaststroke technique',
          'Start / turn basics'
        ],
        duration: '45 minutes'
      },
      {
        level: 6,
        title: 'Advanced Swim Lessons for Older Kids',
        goal: 'Master strokes & prepare for competitive or strong recreational swimming',
        requirements: [
          'Mastery of multiple strokes',
          'Demonstrated endurance and skill transitions'
        ],
        skillFocus: [
          'Advanced freestyle / backstroke / breaststroke / butterfly',
          'Efficient starts, turns, wall push‑offs',
          'Treading water (45+ sec)',
          'Swim multiple lengths comfortably'
        ],
        duration: '45 minutes'
      }
    ];
  }

  getLevel(levelNumber: number): SwimLevel | undefined {
    return this.getLevels().find(l => l.level === levelNumber);
  }
}
