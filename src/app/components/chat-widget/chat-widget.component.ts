import {
  Component, signal, ViewChild, ElementRef,
  AfterViewChecked, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './chat-widget.component.html',
  styleUrls: ['./chat-widget.component.scss']
})
export class ChatWidgetComponent implements AfterViewChecked {
  private http = inject(HttpClient);
  authService  = inject(AuthService);

  isOpen    = signal(false);
  messages  = signal<ChatMessage[]>([]);
  inputText = '';
  loading   = signal(false);
  errorMsg  = signal('');

  readonly suggestions = [
    'What swimming level am I?',
    'How do I improve my freestyle?',
    'What should a beginner focus on?',
    'Tell me about your swim programs'
  ];

  @ViewChild('widgetBottom') private widgetBottom?: ElementRef<HTMLElement>;
  private shouldScroll = false;

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.widgetBottom) {
      this.widgetBottom.nativeElement.scrollIntoView({ behavior: 'smooth' });
      this.shouldScroll = false;
    }
  }

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  close(): void {
    this.isOpen.set(false);
  }

  send(text?: string): void {
    const msg = (text ?? this.inputText).trim();
    if (!msg || this.loading()) return;

    this.messages.update(m => [...m, { role: 'user', text: msg }]);
    this.inputText = '';
    this.loading.set(true);
    this.errorMsg.set('');
    this.shouldScroll = true;

    this.http
      .post<{ reply: string }>(`${environment.apiUrl}/chat`, { message: msg })
      .subscribe({
        next: (res) => {
          this.messages.update(m => [...m, { role: 'ai', text: res.reply || '…' }]);
          this.loading.set(false);
          this.shouldScroll = true;
        },
        error: (err) => {
          this.errorMsg.set(
            err?.error?.message || err?.message || 'Something went wrong. Please try again.'
          );
          this.loading.set(false);
        }
      });
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }
}
