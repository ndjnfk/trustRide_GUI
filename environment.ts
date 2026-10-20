// ── environment.ts (development) ─────────────────────────────────────────────
export const environment = {
  production: false,
  // apiUrl: 'http://localhost:3333',   // AdonisJS dev server
  apiUrl: 'https://trustridesre.com/api',   // production (AdonisJS)
  // apiUrl: 'http://34.207.242.45:3333/',   // AdonisJS dev server
  // apiUrl:'https://bsf2020.fun/api'
  // apiUrl: 'https://trustridesre.com/new-design/api',

  // ── Firebase Cloud Messaging (browser push) ──
  // public/firebase-messaging-sw.js me yahi config duplicate hai — dono sync rakho.
  firebase: {
    apiKey: 'AIzaSyDgsgcdaQWq-qOhLHSS4J8qBh_bihfR2Uk',
    authDomain: 'trustridesre-c552f.firebaseapp.com',
    projectId: 'trustridesre-c552f',
    storageBucket: 'trustridesre-c552f.firebasestorage.app',
    messagingSenderId: '901165443701',
    appId: '1:901165443701:web:efe6e901d78ff8ec13e63c',
    measurementId: 'G-3JP055SYGP',
  },
  // Web Push certificate (VAPID public key) — Firebase console → Cloud Messaging → Web configuration
  vapidKey: 'BPtM2NaV4G-l0nm78ueWwnuUBAyHPONkgvQls3_Hd3MPeQOYMIMezhGnYWwGmZKKRekBfdTUg6LbPI_3_UC9Gbw',
}

/* ─────────────────────────────────────────────────────────────────────────────
   environment.production.ts (production)
   Replace the values below for your live server.
   ───────────────────────────────────────────────────────────────────────────── */

// export const environment = {
//   production: true,
//   apiUrl: 'https://api.yourdomain.com',
// }