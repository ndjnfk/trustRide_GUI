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

// Click → app ka sahi page kholo (ya pehle se khuli tab focus karo).
// FCM SDK original payload ko notification.data.FCM_MSG me rakhta hai.
self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  n.close();

  const fcmMsg = (n.data && n.data.FCM_MSG) || {};
  const data = fcmMsg.data || n.data || {};
  const path = data.url || '/';
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client && client.url !== target) {
            return client.navigate(target).catch(() => undefined);
          }
          return;
        }
      }
      return clients.openWindow(target);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
