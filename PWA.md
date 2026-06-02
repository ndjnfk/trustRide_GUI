# TrustRides — Installable PWA

App ab ek **installable PWA** hai. Koi bhi logged-in user app ko apne phone/desktop
par "Install / Add to Home Screen" se download kar sakta hai — alag se Play Store
ya APK ki zaroorat nahi.

## User ke liye kaise dikhega

- Login karne ke baad header me ek **"Install app"** button (download icon) aata hai.
- Tap karte hi:
  - **Android / Chrome / Edge (desktop):** native "Install app" dialog khulta hai.
  - **iPhone / Safari:** ek hint dikhta hai — Share (□↑) → "Add to Home Screen".
- Install hone ke baad button apne aap chhup jaata hai, aur app home screen icon se
  full-screen (standalone) khulta hai.

## Button kab dikhta hai (requirements)

PWA install sirf tab offer hota hai jab:

1. App **HTTPS** par serve ho rahi ho — `https://trustridesre.com` ✅
2. **Production build** chal rahi ho (service worker sirf production me register hota hai).
3. User abhi tak install na kiya ho (standalone me na chal raha ho).

> Local `ng serve` (dev) me service worker register nahi hota, isliye install button
> dev me nahi dikhega — yeh normal hai. Test karne ke liye production build ko HTTPS par
> serve karo (neeche dekho).

## Kya add hua

| File | Kaam |
|------|------|
| `public/manifest.webmanifest` | App ka naam, colors, icons, standalone display |
| `public/icons/*` | 192 / 512 / maskable / apple-touch icons (TrustRides logo) |
| `ngsw-config.json` | Angular service worker caching config |
| `angular.json` (production) | `serviceWorker: "ngsw-config.json"` enable |
| `src/app/app.config.ts` | `provideServiceWorker('ngsw-worker.js', ...)` |
| `src/index.html` | manifest link + theme-color + apple-touch-icon meta |
| `src/app/services/pwa-install.ts` | `beforeinstallprompt` capture + install logic |
| `src/app/components/header/*` | Header me "Install app" button |
| `scripts/generate-pwa-icons.mjs` | Icons regenerate karne ka script |

## Build & deploy

```bash
# Production build (service worker + manifest is me aate hain)
npm run build

# Output: dist/realtime-app/  (browser/ folder ko HTTPS par serve karo,
# ya SSR server chalao:)
npm run serve:ssr:realtime-app
```

Deploy ke baad pehli baar user site khole to service worker register hota hai;
uske baad install prompt available ho jaata hai.

## Icons dobara banane ho to

```bash
node scripts/generate-pwa-icons.mjs
```

Brand color / shape badalna ho to `scripts/generate-pwa-icons.mjs` me edit karke
dobara chala lo.

## Note (PWA vs Capacitor)

- **PWA** = browser se direct install, koi store nahi. (Yeh file.)
- **Capacitor** = native Android APK. (Dekho `CAPACITOR.md`.)
- Dono ek hi codebase se kaam karte hain; ek dusre ko disturb nahi karte
  (service worker sirf web `production` build me hai, Capacitor build me nahi).
