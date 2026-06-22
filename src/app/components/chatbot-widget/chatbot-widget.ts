import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatbotService } from '../../services/chatbot-service';
import { AuthHelper } from '../../helpers/auth-helper';

interface Msg { from: 'bot' | 'me'; text: string; action?: any }

@Component({
  selector: 'app-chatbot-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot-widget.html',
  styleUrl: './chatbot-widget.css',
})
export class ChatbotWidget {
  open = false;
  sending = false;
  draft = '';
  messages: Msg[] = [
    { from: 'bot', text: "👋 Hi! I'm your TrustRide assistant.\nI can help you find or book a ride, raise a concern. How can I help you today?" },
  ];

  // quick suggestion chips
  readonly suggestions = [
    'Show rides for tomorrow',
    'How many rides tomorrow?',
    'Book a ride',
    'Raise a concern',
    'Show all active rides'
  ];

  constructor(
    private chatbot: ChatbotService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  toggle(): void {
    this.open = !this.open;
  }

  pick(s: string): void {
    this.draft = s;
    this.send();
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || this.sending) return;
    this.messages.push({ from: 'me', text });
    this.draft = '';
    this.sending = true;
    this.scrollSoon();

    this.chatbot.ask(text).subscribe({
      next: (res: any) => {
        this.sending = false;
        this.messages.push({ from: 'bot', text: res?.reply || '…', action: res?.action });
        this.cdr.detectChanges();
        this.scrollSoon();
      },
      error: (err: any) => {
        this.sending = false;
        const msg = err?.error?.reply || 'Sorry, I could not reach the assistant. Please try again.';
        this.messages.push({ from: 'bot', text: msg });
        this.cdr.detectChanges();
        this.scrollSoon();
      },
    });
  }

  /** run the action a bot message suggested (open a route, or login-then-route) */
  runAction(action: any): void {
    if (!action) return;
    if (action.type === 'login') {
      const returnUrl = action.then || '/';
      if (AuthHelper.isLoggedIn()) {
        this.router.navigateByUrl(returnUrl);
      } else {
        this.router.navigate(['/login'], { queryParams: { returnUrl } });
      }
      this.open = false;
    } else if (action.type === 'open' && action.route) {
      this.router.navigateByUrl(action.route);
      this.open = false;
    }
  }

  actionLabel(action: any): string {
    if (action?.type === 'login') return 'Log in to continue →';
    if (action?.type === 'open') return 'Open →';
    return 'Go →';
  }

  private scrollSoon(): void {
    setTimeout(() => {
      const el = document.querySelector('.cbw-body');
      if (el) el.scrollTop = el.scrollHeight;
    }, 40);
  }
}
