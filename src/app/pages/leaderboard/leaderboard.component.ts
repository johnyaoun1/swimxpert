import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';

interface LeaderboardEntry {
  user: User;
  bestScore: number;
  totalQuizzes: number;
  averageScore: number;
}

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss']
})
export class LeaderboardComponent implements OnInit {
  leaderboard: LeaderboardEntry[] = [];
  currentUser = this.authService.currentUser;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.loadLeaderboard();
  }

  loadLeaderboard(): void {
    const users = this.authService.getAllUsers();
    
    this.leaderboard = users
      .map(user => {
        const quizResults = user.quizResults || [];
        const bestScore = quizResults.length > 0 
          ? Math.max(...quizResults.map(r => r.percentage))
          : 0;
        const totalQuizzes = quizResults.length;
        const averageScore = quizResults.length > 0
          ? Math.round(quizResults.reduce((sum, r) => sum + r.percentage, 0) / quizResults.length)
          : 0;

        return {
          user,
          bestScore,
          totalQuizzes,
          averageScore
        };
      })
      .filter(entry => entry.totalQuizzes > 0)
      .sort((a, b) => {
        // Sort by best score, then by average score, then by total quizzes
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
        if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
        return b.totalQuizzes - a.totalQuizzes;
      });
  }

  getRankIcon(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }

  isCurrentUser(userId: string): boolean {
    return this.currentUser()?.id === userId;
  }

  getMedalColor(rank: number): string {
    if (rank === 1) return 'text-yellow-500';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-orange-600';
    return 'text-gray-600';
  }
}
