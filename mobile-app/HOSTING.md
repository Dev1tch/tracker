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
npm install -g eas-cli      # already installed on this machine (v20)
eas login                   # create/sign in to a free Expo account at expo.dev
eas init                    # links this project to your Expo account
                            # (writes extra.eas.projectId + owner into app.json — commit that)
```

`eas.json` and the Android `package` / iOS `bundleIdentifier` are already set up.

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
use it today without any Apple account:

```bash
cd mobile-app
eas update --branch preview   # publishes the JS bundle to Expo's servers
# (or `npx expo start` and share the QR while your Mac/Metro is running)
```

Then share the project link. Testers:
1. Install **Expo Go** from the App Store.
2. Open your link / scan the QR in Expo Go.

Caveat: it opens inside Expo Go (not a home-screen app with your icon). It's the
only no-paid-account way to get it onto someone's iPhone.

---

## When you're ready to go fully public

- **Android (Google Play):** $25 one-time. `eas build --profile production`
  (makes an `.aab`), then `eas submit -p android`.
- **iOS (App Store / TestFlight):** $99/yr Apple Developer. Then
  `eas build --profile production -p ios` + `eas submit -p ios`. TestFlight lets
  up to 10,000 external testers install for 90 days per build.

Ping me when you get either account and I'll wire up the production + submit
steps and store metadata.
