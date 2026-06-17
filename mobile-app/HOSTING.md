# Distributing the app so people can download it

You don't have paid Apple/Google developer accounts. Here's the honest reality
and the free path that actually works.

| Platform | Free, no developer account? | How |
|---|---|---|
| **Android** | ✅ Yes | EAS Build → APK with a public download link (~30 days). People download & install directly. |
| **iOS (any iPhone)** | ✅ Yes, via Expo Go | Testers install **Expo Go** from the App Store, then open your link. Not a standalone app. |
| **iOS standalone / TestFlight** | ❌ No | Requires the **$99/yr Apple Developer** account. There is no free way to put a real installable iOS app on someone else's iPhone. |

> The "test version for a few weeks" you read about = the **EAS Build APK link is
> hosted ~30 days** on the free plan, **and/or TestFlight builds last 90 days**
> (paid). For free, the Android APK is the real "download and install" option.

Everything below runs on your Mac, in the `mobile-app/` folder.

---

## One-time setup

```bash
cd mobile-app
npm install                 # if you haven't already
eas login                   # create/sign in to a free Expo account at expo.dev
eas init                    # links this project to your Expo account
                            # (writes extra.eas.projectId + owner into app.json — commit that)
eas update:configure        # adds updates.url for your project
                            # NOTE: keep runtimeVersion as { "policy": "sdkVersion" } —
                            # that's what lets Expo Go open your published updates.
```

Already set up for you: `eas.json`, Android `package` + iOS `bundleIdentifier`,
`expo-updates` installed, and `runtimeVersion: sdkVersion` (Expo Go compatible).

---

## Android — the real "people download it" path (free)

```bash
cd mobile-app
eas build --platform android --profile preview
```

- Builds on Expo's servers (a few minutes, no Android Studio needed).
- When done, EAS prints a **URL + QR code**. That page hosts the **`.apk`** for
  ~30 days. Share the link.
- To install: on an Android phone open the link, download the APK, tap it, and
  allow "install from unknown sources". Done — no Play Store, no Google account.
- Rebuild anytime to refresh the 30-day window: same command.

The build already points at your hosted backend
(`https://tracker-backend-mocha.vercel.app`), so the installed app works on its own.

---

## iOS — free option (Expo Go)

This app runs fully inside **Expo Go** (no custom native modules), so testers can
use it today without any Apple account.

**Persistent link (your Mac can be off)** — after the one-time setup above:

```bash
cd mobile-app
eas update --branch preview --message "preview"
```

This publishes the JS bundle to Expo's servers. Open your project at
**expo.dev → your project → Updates → the `preview` branch**, and there's a QR /
link to share. Testers:
1. Install **Expo Go** from the App Store.
2. Scan that QR (or open the link) in Expo Go.

Re-run `eas update --branch preview` anytime to push a new version — testers just
reopen it, no reinstall.

**Quick alternative (no setup, but your Mac must stay running):**

```bash
npx expo start --tunnel
```

Share the QR it prints; testers scan it in Expo Go over the internet.

Caveat for both: it opens inside Expo Go (not a home-screen app with your icon).
That's the only no-paid-account way to get it onto someone's iPhone.

---

## When you're ready to go fully public

- **Android (Google Play):** $25 one-time. `eas build --profile production`
  (makes an `.aab`), then `eas submit -p android`.
- **iOS (App Store / TestFlight):** $99/yr Apple Developer. Then
  `eas build --profile production -p ios` + `eas submit -p ios`. TestFlight lets
  up to 10,000 external testers install for 90 days per build.

Ping me when you get either account and I'll wire up the production + submit
steps and store metadata.
