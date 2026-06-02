# TrustRides — Android App (Capacitor)

Yeh project ab Capacitor ke through ek native **Android app** me wrap ho chuka hai.
Wahi Angular app (jo `https://trustridesre.com/api` backend use karta hai) ab phone par
native app ki tarah chalega.

## Kya add hua

- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` + plugins (`app`, `status-bar`, `keyboard`) — Capacitor v7 (Node 20 compatible).
- `capacitor.config.ts` — appId `com.trustridesre.app`, appName `TrustRides`, `webDir: dist/realtime-app/browser`.
- `android/` — native Android (Gradle) project. Ise Android Studio me kholo.
- `angular.json` me ek nayi `capacitor` build configuration — SSR/server ke bina ek pure static SPA build banati hai (Capacitor ko static files chahiye, SSR nahi).
- `package.json` me helper scripts.

## Zaroori tools (is machine par abhi missing hain)

APK build/run karne ke liye chahiye:

1. **JDK 17** (Android Gradle Plugin ke liye).
2. **Android Studio** (Android SDK + platform-tools ke saath). Install karte waqt SDK + an emulator ya `adb` set up ho jaata hai.
3. Install ke baad `ANDROID_HOME` / `ANDROID_SDK_ROOT` env variable set ho (Android Studio aam taur par khud kar deta hai).

> Bina inke sirf web build banega; APK nahi.

## Roz ka workflow

```bash
# 1. Angular ka static build banao (Capacitor configuration)
npm run build:capacitor

# 2. Build ko native android project me copy karo
npx cap sync android

# 3. Android Studio me kholo (yahan se Run/Build APK karo)
npx cap open android
```

Shortcut (sab ek saath):

```bash
npm run cap:android      # build + sync + Android Studio open
```

Agar device/emulator connected hai to seedha run:

```bash
npm run cap:run:android  # build + sync + device par chalao
```

## Android Studio me APK kaise banaye

1. `npx cap open android` se project khulega.
2. Gradle sync khatam hone do.
3. Upar device/emulator select karke **Run ▶** dabao — app install ho jaayega.
4. Release APK ke liye: **Build → Build Bundle(s)/APK(s) → Build APK(s)**.
   APK yahan banega: `android/app/build/outputs/apk/debug/app-debug.apk`

## Notes

- App `https://trustridesre.com/api` se baat karta hai (HTTPS) — Android me cleartext issue nahi aayega.
- Routing path-based hai; Capacitor ka local server SPA fallback handle karta hai, isliye refresh/deep-link theek chalega.
- Backend URL badalna ho to `environment.ts` me `apiUrl` change karke dobara `npm run cap:sync` chalao.
- Code badalne ke baad har baar `npm run build:capacitor && npx cap sync android` zaroori hai (ya `npm run cap:sync`).
