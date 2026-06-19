import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environment';
import { AuthHelper } from '../helpers/auth-helper';
import { SKIP_LOADER_HEADER } from '../interceptors/loader-interceptor';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = environment.apiUrl;
  private socket?: Socket;
  /** rooms we want to be in — re-joined automatically after any (re)connect */
  private joinedThreads = new Set<string>();

  constructor(private http: HttpClient, private zone: NgZone) {}

  private headers() {
    // X-Skip-Loader: chat has its own inline loading — don't flash the global loader
    return {
      Authorization: `Bearer ${AuthHelper.getToken() ?? ''}`,
      [SKIP_LOADER_HEADER]: 'true',
    };
  }

  // ── REST ──
  startThread(rideId: string): Observable<any> {
    return this.http.post(`${this.api}/chat/threads`, { ride_id: rideId }, { headers: this.headers() });
  }
  listThreads(): Observable<any> {
    return this.http.get(`${this.api}/chat/threads`, { headers: this.headers() });
  }
  getUnreadCount(): Observable<any> {
    return this.http.get(`${this.api}/chat/unread-count`, { headers: this.headers() });
  }
  getMessages(threadId: string): Observable<any> {
    return this.http.get(`${this.api}/chat/threads/${threadId}/messages`, { headers: this.headers() });
  }
  sendMessage(threadId: string, text: string): Observable<any> {
    return this.http.post(`${this.api}/chat/threads/${threadId}/messages`, { text }, { headers: this.headers() });
  }
  deleteThread(threadId: string): Observable<any> {
    return this.http.delete(`${this.api}/chat/threads/${threadId}`, { headers: this.headers() });
  }

  // ── Socket ──
  connect(): void {
    // create the socket ONCE; reuse it everywhere (don't recreate while connecting)
    if (this.socket) return;
    const token = AuthHelper.getToken();
    if (!token) return;
    // Create the socket OUTSIDE Angular's zone. socket.io's ping/reconnect timers
    // and the polling transport's XHR would otherwise keep NgZone perpetually
    // "unstable", which on a webview shows a never-ending loading state until the
    // user interacts. Event callbacks re-enter the zone themselves (zone.run).
    this.zone.runOutsideAngular(() => {
      this.socket = io(this.api, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      // re-join all wanted rooms whenever the socket (re)connects
      this.socket.on('connect', () => {
        for (const id of this.joinedThreads) this.socket?.emit('thread:join', id);
      });
    });
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }

  joinThread(threadId: string): void {
    this.joinedThreads.add(threadId);
    this.socket?.emit('thread:join', threadId);
  }
  leaveThread(threadId: string): void {
    this.joinedThreads.delete(threadId);
    this.socket?.emit('thread:leave', threadId);
  }

  onMessage(cb: (msg: any) => void): void {
    this.socket?.on('message:new', cb);
  }
  offMessage(cb: (msg: any) => void): void {
    this.socket?.off('message:new', cb);
  }
  onThreadUpdate(cb: (u: any) => void): void {
    this.socket?.on('thread:update', cb);
  }
  offThreadUpdate(cb: (u: any) => void): void {
    this.socket?.off('thread:update', cb);
  }
  onThreadDeleted(cb: (u: any) => void): void {
    this.socket?.on('thread:deleted', cb);
  }
  offThreadDeleted(cb: (u: any) => void): void {
    this.socket?.off('thread:deleted', cb);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
