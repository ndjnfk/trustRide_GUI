import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';


// ✅ Yeh pehle run hoga
const SESSION_FLAG = 'app_session_active';
if (!sessionStorage.getItem(SESSION_FLAG)) {
  
  localStorage.removeItem('rideStats');
  localStorage.removeItem('reviewed_bookings');
  sessionStorage.setItem(SESSION_FLAG, 'true');
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
