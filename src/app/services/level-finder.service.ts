import { Injectable } from '@angular/core';

export interface LevelFinderAnswers {
  age: number;
  q1: boolean | null;
  q2: boolean | null;
  q3: boolean | null;
  q4: boolean | null;
  q5: boolean | null;
  q6: boolean | null;
  q7: boolean | null;
  q8: boolean | null;
  q9: boolean | null;
  q10: boolean | null;
  q11: boolean | null;
  q12: boolean | null;
  q13: boolean | null;
}

@Injectable({
  providedIn: 'root'
})
export class LevelFinderService {
  determineLevel(answers: LevelFinderAnswers): number {
    const { age, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q12, q13 } = answers;

    // Age 3 → Level 1 automatically
    if (age === 3) {
      return 1;
    }

    // For age 4+
    if (q1 === false || q1 === null) {
      return 1;
    }

    if (q1 === true && (q2 === false || q2 === null)) {
      return 2;
    }

    if (q2 === true && (q3 === false || q3 === null)) {
      return 2;
    }

    if (q3 === true && (q4 === false || q4 === null)) {
      return 3;
    }

    if (q4 === true && (q5 === false || q5 === null)) {
      return 3;
    }

    // Q5 = YES & (Q6 = NO & Q7 = NO) → Level 4
    if (q5 === true && (q6 === false || q6 === null) && (q7 === false || q7 === null)) {
      return 4;
    }

    // Q6 = YES or Q7 = YES → Level 4
    if (q6 === true || q7 === true) {
      // Q6 + Q7 + Q8 ≥ 2 YES & Q9 = NO → Level 5
      const advancedSkills = [q6, q7, q8].filter(q => q === true).length;
      if (advancedSkills >= 2 && (q9 === false || q9 === null)) {
        return 5;
      }
      
      // Q9 = YES & Q10 = YES & (Q12 = YES or Q13 = YES) → Level 6
      if (q9 === true && q10 === true && (q12 === true || q13 === true)) {
        return 6;
      }
      
      // If Q9 is true but doesn't meet Level 6 criteria, check for Level 5
      if (q9 === true && advancedSkills >= 2) {
        return 5;
      }
      
      return 4;
    }

    // Default fallback
    return 4;
  }

  getLevelDescription(level: number): string {
    const descriptions: { [key: number]: string } = {
      1: 'Early Swim Lessons - Perfect for building water comfort and confidence',
      2: 'Beginner Swim Lessons - Developing independent buoyancy and simple movement',
      3: 'Beginner-Intermediate Swim Lessons - Beginning independent swimming with coordination',
      4: 'Intermediate Swim Lessons - Building coordinated strokes and stamina',
      5: 'Advanced Swim Lessons - Refining strokes and increasing endurance',
      6: 'Advanced Swim Lessons for Older Kids - Mastering strokes and preparing for competitive swimming'
    };
    return descriptions[level] || 'Swim Lessons';
  }
}
