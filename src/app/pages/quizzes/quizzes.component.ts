import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  timestamp: Date;
}

@Component({
  selector: 'app-quizzes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './quizzes.component.html',
  styleUrls: ['./quizzes.component.scss']
})
export class QuizzesComponent implements OnInit {
  currentQuestionIndex = 0;
  selectedAnswer: number | null = null;
  showResult = false;
  quizCompleted = false;
  score = 0;
  quizResult: QuizResult | null = null;
  timeStarted = new Date();

  questions: QuizQuestion[] = [
    {
      id: 1,
      question: 'What is the most important safety rule when entering a pool?',
      options: [
        'Jump in immediately',
        'Always have an adult present',
        'Swim alone',
        'Run around the pool'
      ],
      correctAnswer: 1,
      explanation: 'Always have an adult present when swimming. This is the most important safety rule to prevent accidents.'
    },
    {
      id: 2,
      question: 'What stroke is also known as the "front crawl"?',
      options: [
        'Backstroke',
        'Freestyle',
        'Breaststroke',
        'Butterfly'
      ],
      correctAnswer: 1,
      explanation: 'Freestyle is also called the front crawl. It\'s the fastest and most efficient swimming stroke.'
    },
    {
      id: 3,
      question: 'How should you breathe while doing freestyle?',
      options: [
        'Hold your breath the entire time',
        'Breathe to the side every 2-3 strokes',
        'Breathe underwater',
        'Only breathe at the end'
      ],
      correctAnswer: 1,
      explanation: 'In freestyle, you should breathe to the side every 2-3 strokes. This helps maintain rhythm and oxygen flow.'
    },
    {
      id: 4,
      question: 'What is the correct body position for swimming?',
      options: [
        'Vertical in the water',
        'Horizontal and streamlined',
        'Sitting position',
        'Standing position'
      ],
      correctAnswer: 1,
      explanation: 'A horizontal and streamlined body position reduces drag and makes swimming more efficient.'
    },
    {
      id: 5,
      question: 'How many swimming strokes are there in competitive swimming?',
      options: [
        '2',
        '3',
        '4',
        '5'
      ],
      correctAnswer: 2,
      explanation: 'There are 4 main competitive swimming strokes: Freestyle, Backstroke, Breaststroke, and Butterfly.'
    },
    {
      id: 6,
      question: 'What should you do if you get tired while swimming?',
      options: [
        'Keep swimming faster',
        'Stop and rest, float on your back',
        'Swim to the bottom',
        'Panic and call for help immediately'
      ],
      correctAnswer: 1,
      explanation: 'If you get tired, stop and rest by floating on your back. This is a safe way to recover energy.'
    },
    {
      id: 7,
      question: 'What is the purpose of a kickboard?',
      options: [
        'To sit on',
        'To practice kicking and leg strength',
        'To play games',
        'To dive from'
      ],
      correctAnswer: 1,
      explanation: 'A kickboard is used to practice kicking and build leg strength while keeping your upper body supported.'
    },
    {
      id: 8,
      question: 'What color flag indicates it\'s safe to swim at the beach?',
      options: [
        'Red flag',
        'Yellow flag',
        'Green flag',
        'Blue flag'
      ],
      correctAnswer: 2,
      explanation: 'A green flag at the beach indicates safe swimming conditions. Red means dangerous, yellow means caution.'
    },
    {
      id: 9,
      question: 'What is the first thing you should do before entering a pool?',
      options: [
        'Jump in',
        'Shower to remove dirt and oils',
        'Eat a big meal',
        'Run around the pool deck'
      ],
      correctAnswer: 1,
      explanation: 'Always shower before entering a pool to remove dirt, oils, and bacteria. This keeps the pool clean and safe for everyone.'
    },
    {
      id: 10,
      question: 'What is the proper way to enter a pool if you\'re not sure of the depth?',
      options: [
        'Dive in headfirst',
        'Jump in feet first',
        'Slide in on your stomach',
        'Run and jump'
      ],
      correctAnswer: 1,
      explanation: 'Always enter feet first if you\'re unsure of the depth. This prevents head injuries from hitting the bottom.'
    }
  ];

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.resetQuiz();
  }

  resetQuiz(): void {
    this.currentQuestionIndex = 0;
    this.selectedAnswer = null;
    this.showResult = false;
    this.quizCompleted = false;
    this.score = 0;
    this.quizResult = null;
    this.timeStarted = new Date();
  }

  selectAnswer(index: number): void {
    this.selectedAnswer = index;
  }

  submitAnswer(): void {
    if (this.selectedAnswer === null) return;

    const currentQuestion = this.questions[this.currentQuestionIndex];
    if (this.selectedAnswer === currentQuestion.correctAnswer) {
      this.score++;
    }

    this.showResult = true;
  }

  nextQuestion(): void {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.selectedAnswer = null;
      this.showResult = false;
    } else {
      this.completeQuiz();
    }
  }

  completeQuiz(): void {
    this.quizCompleted = true;
    const percentage = Math.round((this.score / this.questions.length) * 100);
    
    this.quizResult = {
      score: this.score,
      totalQuestions: this.questions.length,
      percentage: percentage,
      timestamp: new Date()
    };

    // Save quiz result to user profile
    const user = this.authService.currentUser();
    if (user) {
      this.authService.addQuizResult({
        score: this.score,
        totalQuestions: this.questions.length,
        percentage: percentage,
        timestamp: new Date()
      });
    }
  }

  getCurrentQuestion(): QuizQuestion {
    return this.questions[this.currentQuestionIndex];
  }

  isCorrectAnswer(): boolean {
    return this.selectedAnswer === this.questions[this.currentQuestionIndex].correctAnswer;
  }

  getScoreMessage(): string {
    if (!this.quizResult) return '';
    const percentage = this.quizResult.percentage;
    if (percentage >= 90) return '🏆 Excellent! You\'re a swimming expert!';
    if (percentage >= 70) return '🎉 Great job! You know your swimming!';
    if (percentage >= 50) return '👍 Good effort! Keep learning!';
    return '💪 Keep practicing! You\'ll get better!';
  }

  getProgressPercentage(): number {
    return Math.round(((this.currentQuestionIndex + 1) / this.questions.length) * 100);
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index); // A, B, C, D
  }
}
