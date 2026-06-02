
import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Chart } from 'chart.js/auto';
import { SocketService } from '../../services/socket';

@Component({
  selector: 'app-charts',
  imports: [CommonModule],
  templateUrl: './charts.html',
  styleUrl: './charts.css',
})
export class Charts {

  data: any;
  chart: any;

  constructor(private socketService: SocketService) {}

  ngOnInit() {
    this.socketService.listen('health:update').subscribe((res: any) => {
      this.data = res;

      // 🔥 Update chart dynamically
      if (this.chart) {
        this.chart.data.datasets[0].data = [
          parseFloat(res.memory.used),
          parseFloat(res.memory.free)
        ];
        this.chart.update();
      }
    });
  }

  ngAfterViewInit() {
    this.createChart();
  }

  createChart() {
    this.chart = new Chart('myChart', {
      type: 'bar',
      data: {
        labels: ['Used Memory', 'Free Memory'],
        datasets: [
          {
            label: 'Memory (MB)',
            data: [0, 0],
          },
        ],
      },
      options: {
        responsive: true,
      },
    });
  }
}
