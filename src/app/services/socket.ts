import { Injectable } from '@angular/core'
import { io, Socket } from 'socket.io-client'
import { Observable } from 'rxjs'

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket

  constructor() {
    this.socket = io('http://localhost:3334')
    //  this.socket = io('/', {
    //   path: '/socket.io/',
    //   transports: ['websocket', 'polling'],
    // })
   
    

    this.socket.on('connect', () => {
      console.log('Connected:', this.socket.id)
    })
  }

  listen(eventName: string): Observable<any> {
    return new Observable((observer) => {
      this.socket.on(eventName, (data) => {
        console.log('Socket received:', data) // 👈 IMPORTANT
        observer.next(data)
      })
    })
  }
}