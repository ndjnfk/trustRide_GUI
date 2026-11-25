/* eslint-disable no-undef */
/*
 * Firebase Cloud Messaging service worker — background push ke liye.
 *
 * Ye ngsw-worker.js (Angular PWA) ke saath chalta hai: app ise alag scope
 * ('/firebase-cloud-messaging-push-scope/') par register karti hai taaki dono
 * ek-doosre ko replace na karein. Firebase config yahan duplicate hai kyunki
 * service worker Angular bundle/environment ko import nahi kar sakta — GUI ke
 * environment.ts ke saath sync rakho.
 */
// ── Notification click → usi ride/page par le jao ──
// ZAROORI: ye listener firebase.messaging() se PEHLE register hona chahiye.
// FCM SDK ka apna notificationclick listener stopImmediatePropagation() karta hai
// aur fcmOptions.link na ho to kuch nahi kholta — baad wala listener chalta hi
// nahi tha (click par notification band, redirect nahi). Isliye hum pehle chalte
// hain aur khud propagation rokte hain.
self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation();
  const n = event.notification;
  n.close();

  // FCM SDK original payload ko notification.data.FCM_MSG me rakhta hai
  const fcmMsg = (n.data && n.data.FCM_MSG) || {};
  const data = fcmMsg.data || n.data || {};
  const path = data.url || '/';
  const target = new URL(path, self.location.origin).href;
  const rel = target.slice(self.location.origin.length) || '/';

  event.waitUntil((async () => {
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = list.find((c) => c.url.startsWith(self.location.origin));
    if (!client) return clients.openWindow(target);

    try { await client.focus(); } catch (e) { /* ignore */ }
    if (client.url === target) return;
    // Ye SW alag scope par hai, tab ko control nahi karta → client.navigate()
    // reject hota hai. Isliye app ko message: Angular router khud navigate kare.
    try {
      client.postMessage({ type: 'push:navigate', url: rel });
    } catch (e) {
      return clients.openWindow(target);
    }
  })());
});

importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDgsgcdaQWq-qOhLHSS4J8qBh_bihfR2Uk',
  authDomain: 'trustridesre-c552f.firebaseapp.com',
  projectId: 'trustridesre-c552f',
  storageBucket: 'trustridesre-c552f.firebasestorage.app',
  messagingSenderId: '901165443701',
  appId: '1:901165443701:web:efe6e901d78ff8ec13e63c',
});

const messaging = firebase.messaging();

// Backend `notification` + `webpush.notification` bhejta hai, isliye FCM SDK
// background me notification khud dikhata hai. Yahan dobara showNotification
// mat karo — warna do baar dikhegi. Sirf log.
messaging.onBackgroundMessage((payload) => {
  // eslint-disable-next-line no-console
  console.log('[fcm-sw] background message', payload && payload.data && payload.data.type);
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
