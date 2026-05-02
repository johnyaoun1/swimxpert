import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

export interface AiLevelRequest {
  age: number;
  answers: { question: string; answer: string }[];
}

export interface AiLevelResult {
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite';
  explanation: string;
  recommendations: string[];
}

@Injectable({
  providedIn: 'root'
})
export class LevelFinderService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/level-finder`;

  analyzeLevel(request: AiLevelRequest): Observable<AiLevelResult> {
    return this.http.post<AiLevelResult>(`${this.apiUrl}/analyze`, request);
  }

  /** Maps AI level name to a 1-6 number for the star/badge display. */
  levelNameToNumber(level: string): number {
    const map: { [k: string]: number } = {
      Beginner: 2,
      Intermediate: 4,
      Advanced: 5,
      Elite: 6,
    };
    return map[level] ?? 3;
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
