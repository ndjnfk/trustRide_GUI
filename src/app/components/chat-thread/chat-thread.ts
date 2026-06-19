import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, NgZone, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService } from '../../services/chat-service';
import { environment } from '../../../../environment';

@Component({
  selector: 'app-chat-thread',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-thread.html',
  styleUrl: './chat-thread.css',
})
export class ChatThread {
  imageBase = environment.apiUrl;

  threadId = '';
  loading = true;
  error = '';
  sending = false;

  enabled = true;
  other: any = null;
  rider: any = null;
  passenger: any = null;
  myRole = '';
  ride: any = null;
  otherId = '';

  messages: any[] = [];
  private ids = new Set<string>();
  draft = '';

  @ViewChild('scrollBox') scrollBox?: ElementRef<HTMLDivElement>;

  // socket.io callbacks fire OUTSIDE Angular's zone — run inside it so the
  // incoming message renders immediately (real-time) without a refresh.
  private onMsg = (m: any) => this.zone.run(() => this.handleIncoming(m));
  private pollTimer: any = null;

  private destroyed = false;

  constructor(
    private chat: ChatService,
    private route: ActivatedRoute,
    private router: Router,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  /** force a render — guards against the destroyed view */
  private render(): void {
    if (this.destroyed) return;
    try { this.cdr.detectChanges(); } catch { /* view gone */ }
  }

  ngOnInit(): void {
    this.threadId = this.route.snapshot.paramMap.get('threadId') ?? '';
    if (!this.threadId) { this.error = 'Conversation not found.'; this.loading = false; return; }

    this.chat.connect();
    this.chat.joinThread(this.threadId);
    this.chat.onMessage(this.onMsg);
    this.load();

    // Always poll as a backstop so messages update without a manual refresh,
    // even if the WebSocket connects but isn't delivering events. The request
    // skips the global loader and dedups by id, so it's silent and harmless;
    // when WS works, messages still arrive instantly between polls.
    // Run the timer OUTSIDE Angular's zone — a recurring setInterval inside the
    // zone keeps the app from ever stabilising (continuous loading on a webview).
    // refreshNew() calls render() explicitly, so the UI still updates.
    this.zone.runOutsideAngular(() => {
      this.pollTimer = setInterval(() => this.refreshNew(), 1500);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.chat.leaveThread(this.threadId);
    this.chat.offMessage(this.onMsg);
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  /** append-only refresh (dedups by id) — used by the polling fallback */
  private refreshNew(): void {
    this.chat.getMessages(this.threadId).subscribe({
      next: (res: any) => {
        const before = this.messages.length;
        for (const m of res?.messages ?? []) this.push(m);
        if (res?.thread) this.enabled = !!res.thread.enabled;
        if (this.messages.length !== before) {
          this.render();
          this.scrollSoon();
        }
      },
      error: () => { /* ignore transient errors */ },
    });
  }

  load(): void {
    this.loading = true;
    this.chat.getMessages(this.threadId).subscribe({
      next: (res: any) => {
        const t = res?.thread ?? {};
        this.enabled = !!t.enabled;
        this.other = t.other ?? null;
        this.rider = t.rider ?? null;
        this.passenger = t.passenger ?? null;
        this.myRole = t.role ?? '';
        this.ride = t.ride ?? null;
        this.otherId = String(t.other?._id ?? '');
        this.messages = [];
        this.ids.clear();
        for (const m of res?.messages ?? []) this.push(m);
        this.loading = false;
        this.scrollSoon();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load conversation.';
      },
    });
  }

  private push(m: any): void {
    const id = String(m._id);
    if (this.ids.has(id)) return;
    this.ids.add(id);
    this.messages.push({ ...m, mine: String(m.sender_id) !== this.otherId });
  }

  private handleIncoming(m: any): void {
    if (String(m.thread_id) !== this.threadId) return;
    this.push(m);
    this.render();
    this.scrollSoon();
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || !this.enabled) return;

    // Optimistic: show the message and clear the input immediately, so the
    // composer never gets stuck waiting on the network.
    this.draft = '';
    this.error = '';
    const tempId = 'tmp-' + Date.now();
    this.messages.push({ _id: tempId, text, mine: true, pending: true });
    this.ids.add(tempId);
    this.render();
    this.scrollSoon();

    this.chat.sendMessage(this.threadId, text).subscribe({
      next: (res: any) => {
        // swap the optimistic bubble for the saved one (dedups with the WS echo)
        this.dropMessage(tempId);
        if (res?.message) this.push(res.message);
        this.render();
        this.scrollSoon();
      },
      error: (err) => {
        this.dropMessage(tempId);
        this.draft = text; // restore so the user can retry
        this.render();
        if (err?.status === 403) {
          this.enabled = false;
          this.error = err?.error?.message || 'This chat is closed.';
        } else {
          this.error = err?.error?.message || 'Could not send message.';
        }
      },
    });
  }

  private dropMessage(id: string): void {
    this.ids.delete(id);
    const i = this.messages.findIndex((m) => String(m._id) === id);
    if (i >= 0) this.messages.splice(i, 1);
  }

  private scrollSoon(): void {
    setTimeout(() => {
      const el = this.scrollBox?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 30);
  }

  initials(name: string): string {
    return (name || '?').split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  /** the logged-in user's own display name (based on their role in this thread) */
  get myName(): string {
    return (this.myRole === 'rider' ? this.rider?.name : this.passenger?.name) || 'You';
  }

  /** 2-letter initials of whoever sent a given message */
  senderInitials(m: any): string {
    const name = m.mine ? this.myName : (this.other?.name || '');
    return this.initials(name);
  }

  goBack(): void {
    this.router.navigate(['/chat']);
  }
}
