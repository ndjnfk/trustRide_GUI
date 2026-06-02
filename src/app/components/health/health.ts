import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocketService } from '../../services/socket';


@Component({
  selector: 'app-health',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './health.html',
})
export class HealthComponent implements OnInit {

  data: any;  

  constructor(
    private socketService: SocketService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.socketService.listen('health:update').subscribe((res: any) => {
      console.log('Component received:', res);

      this.data = res;

      // 🔥 FORCE UI UPDATE
      this.cd.detectChanges();
    });
  }
}