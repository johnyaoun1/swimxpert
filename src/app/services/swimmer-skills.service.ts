import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SkillItem {
  name: string;
  isUnlocked: boolean;
}

export interface SkillLevelBlock {
  level: number;
  completionPercent: number;
  skills: SkillItem[];
}

export interface SwimmerSkillCard {
  id: number;
  parentUserId: number;
  name: string;
  age: number;
  level: number;
  profilePictureUrl?: string;
  levels: SkillLevelBlock[];
}

@Injectable({
  providedIn: 'root'
})
export class SwimmerSkillsService {
  private readonly apiUrl = 'http://localhost:5002/api/swimmerskills';

  constructor(private http: HttpClient) {}

  getMySwimmers(): Observable<SwimmerSkillCard[]> {
    return this.http.get<SwimmerSkillCard[]>(`${this.apiUrl}/my`);
  }

  toggleSkill(swimmerId: number, level: number, skillName: string, isUnlocked: boolean): Observable<SwimmerSkillCard> {
    return this.http.put<SwimmerSkillCard>(`${this.apiUrl}/${swimmerId}/skills`, {
      level,
      skillName,
      isUnlocked
    });
  }
}
