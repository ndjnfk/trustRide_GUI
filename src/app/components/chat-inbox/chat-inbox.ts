import { CommonModule } from '@angular/common';
import { Component, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat-service';
import { environment } from '../../../../environment';

@Component({
  selector: 'app-chat-inbox',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-inbox.html',
  styleUrl: './chat-inbox.css',
})
export class ChatInbox {
  imageBase = environment.apiUrl;

  loading = true;
  error = '';
  threads: any[] = [];

  get activeThreads(): any[] {
    return this.threads.filter((t) => !t.archived);
  }
  get archivedThreads(): any[] {
    return this.threads.filter((t) => t.archived);
  }

  private onUpdate = (u: any) => this.zone.run(() => this.applyUpdate(u));

  constructor(private chat: ChatService, private router: Router, private zone: NgZone) {}

  ngOnInit(): void {
    this.chat.connect();
    this.chat.onThreadUpdate(this.onUpdate);
    this.load();
  }

  ngOnDestroy(): void {
    this.chat.offThreadUpdate(this.onUpdate);
  }

  load(): void {
    this.loading = true;
    this.chat.listThreads().subscribe({
      next: (res: any) => { this.threads = res?.data ?? []; this.loading = false; },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401) { this.router.navigate(['/login']); return; }
        this.error = err?.error?.message || 'Failed to load conversations.';
      },
    });
  }

  private applyUpdate(u: any): void {
    const t = this.threads.find((x) => String(x._id) === String(u.thread_id));
    if (t) {
      t.last_message = u.last_message;
      t.updated_at = u.updated_at;
      t.unread = (t.unread ?? 0) + 1;
      this.threads.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else {
      this.load(); // a brand-new conversation arrived
    }
  }

  open(t: any): void {
    if (!t?.enabled) return; // locked / archived chats are fully disabled
    this.router.navigate(['/chat', t._id]);
  }

  initials(name: string): string {
    return (name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  goBack(): void {
    window.history.back();
  }
}
