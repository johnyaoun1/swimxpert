import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LevelFinderRequest {
  age: number;
  answers: { question: string; answer: string }[];
}

/** Rules-based placement result from POST /api/level-finder/analyze */
export interface LevelFinderResult {
  level: string;
  levelNumber: number;
  title?: string;
  explanation: string;
  recommendations: string[];
}

@Injectable({
  providedIn: 'root'
})
export class LevelFinderService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/level-finder`;

  analyzeLevel(request: LevelFinderRequest): Observable<LevelFinderResult> {
    return this.http.post<LevelFinderResult>(`${this.apiUrl}/analyze`, request);
  }

  /** Prefer API levelNumber; fall back to short band names for older cached results. */
  toLevelNumber(result: LevelFinderResult): number {
    if (result.levelNumber >= 1 && result.levelNumber <= 6)
      return result.levelNumber;
    const map: Record<string, number> = {
      Early: 1,
      Beginner: 2,
      'Beginner-Intermediate': 3,
      Intermediate: 4,
      Advanced: 5,
      Elite: 6
    };
    return map[result.level] ?? 1;
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
