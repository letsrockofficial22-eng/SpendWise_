# SpendWise Android setup and deployment

This guide covers building the existing SpendWise Next.js app as an Android APK with Capacitor. The website continues to use the normal Next.js server build; Android uses a separate static export embedded in the APK.

## Compatibility and current scope

- The app pages use browser-side Supabase access. The former middleware route guard and callback route handler were replaced with static-compatible client routing; Supabase Row Level Security (RLS) remains the data access boundary.
- The generated Android project uses application ID `com.yourdomain.spendwise`, minimum SDK 24, and target SDK 36.
- The Android wrapper includes status-bar and splash styling, keyboard resize behavior, Android back handling, external-link handoff, custom authentication deep links, CSV sharing, and local notifications.
- Supabase remains the cloud source of truth. After a user has signed in, transactions, budgets, loans, recurring bills, shared expense splits, and preferences are cached per account in local app storage. New offline changes are queued and retried when connectivity returns.
- The app does not show an offline warning. If a cloud sync fails while online, the app keeps the local changes and reports that they could not sync.
- Use the refresh button in the workspace top bar to fetch the latest cloud data. It leaves local data unchanged while offline; queued changes still sync automatically after reconnecting.
- Supabase Realtime subscriptions refresh open tabs while online. Remote push notifications are not configured; current loan and recurring-item reminders are local to the device.
- On reopening offline, the app uses the locally stored session when available and restores the last cached account if Supabase needs an internet connection to refresh an expired session. Sign out clears this offline account shortcut.
- Local cached records are stored in the app's IndexedDB sandbox and are not separately encrypted by SpendWise. Keep the device protected with its screen lock. Clearing app data or uninstalling the app removes any changes that have not synced.
- First sign-in still requires internet. Offline access requires an existing signed-in session and previously opened or locally created account data.
- Loans and recurring bill reminders are scheduled on-device without a network connection. Android notification permission is required; reminders target about 9:00 AM the day before and Android may deliver them later. The device's notification setting can disable app reminders.
- Recording a recurring item creates an income or expense transaction and advances its due date. A loan payment updates the loan balance and creates a linked transaction.
- Receipts are private cloud attachments (JPG, PNG, WebP, or PDF, up to 5 MB) and require the receipt migration and a configured Supabase project; they are not available offline.
- Shared expense splits are private records in the current user's account. Names do not receive invitations or notifications and do not need SpendWise accounts.
- JSON backups are AES-GCM encrypted with a user passphrase; older plaintext backups remain importable. Restore accepts only a backup for the same signed-in account and merges new record IDs without overwriting existing ones. Local IndexedDB data is not encrypted.
- Password recovery, Google sign-in, confirmed email changes, and account deletion are available after configuring their Supabase Auth provider, redirect URLs, and Edge Function. Test each flow on a real device before distributing the APK.
- A debug APK can be built with Android Studio's Java 21 JBR and a configured Android SDK. Test notifications, sharing, and offline behavior on a physical Android device before distribution.

## Requirements

Install:

1. Node.js 22 or newer and npm.
2. Android Studio with the Android SDK, SDK Platform 36, Android SDK Build-Tools, and an Android emulator or USB-connected phone.
3. A Java 21 JDK (Android Studio's bundled JBR is suitable).

On Windows, enable Developer options and USB debugging on a physical phone if installing via `adb`.

## Configure Supabase

1. Create or select your Supabase project.
2. Apply the migrations in order:
   - `supabase/migrations/20261030000000_initial.sql`
   - `supabase/migrations/20261030000001_profile_names.sql`
   - `supabase/migrations/20261104000000_finance_features.sql`
3. In Supabase **Connect / API Keys**, copy the project URL and the publishable key (or legacy anon key). Never use a service-role key in the app.
4. Create `.env.local` in the project root:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-OR-ANON-KEY
   ```

5. In Supabase **Authentication / URL Configuration**, set the Site URL to the deployed website origin. Add these redirect URLs:
   - `https://YOUR-DOMAIN/auth/confirm`
   - `https://YOUR-DOMAIN/auth/callback`
   - `spendwise://auth/confirm`
   - `spendwise://auth/callback`

   Add local or preview website URLs if you use them. Keep the Supabase confirmation email template compatible with its normal confirmation redirect. The Android app opens the confirmation and OAuth/reset callbacks through the app deep link.
6. Enable email confirmation and configure production SMTP as appropriate. Confirm links, login, and session restoration must be tested with your own Supabase project.

## Build and deploy the website

The regular website build is unchanged:

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm start
```

Deploy this server build to a Node.js host that supports Next.js. Configure the two `NEXT_PUBLIC_SUPABASE_*` variables in that host's build/runtime environment. Do not deploy the `out` directory as the website's production build; `out` is reserved for the Android bundle.

## Build the Android debug APK

Run these commands from the SpendWise project root:

```powershell
npm ci
npm run build:android
npx cap sync android
npx cap open android
```

`build:android` creates the static app under `out` using the environment variables from `.env.local`. `cap sync` copies that web build and the Capacitor plugins into `android`.

In Android Studio, wait for Gradle sync, select a device/emulator, and use **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

Or build from PowerShell:

```powershell
Push-Location android
.\gradlew.bat assembleDebug
Pop-Location
```

The debug APK is written to:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

Install it on a connected device:

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

The APK contains the website assets. After changing frontend code, rebuild with `npm run build:android`, run `npx cap sync android`, and build a new APK. A website deployment alone does not update an already installed APK.

## Create a signed release APK

Do not distribute a debug APK. In Android Studio:

1. Select **Build > Generate Signed Bundle / APK**.
2. Choose **APK** for direct APK distribution. Choose **Android App Bundle** if publishing through Google Play.
3. Create or select a release keystore. Store it and its passwords outside the source tree and backups under your control; never commit them.
4. Select the `release` build variant and finish the signing flow.
5. Install the generated release APK on a test phone before sharing it.

Keep the same signing key for every update. Increment `versionCode` (and update `versionName`) in `android/app/build.gradle` before creating an update. Losing the signing key prevents signing an update that Android accepts as the same app.

## Device test checklist

- Install, launch, icon, splash screen, and status-bar contrast.
- Sign up, receive and open a confirmation email, sign in, close/reopen the app, and sign out.
- Add, edit, and delete an expense and income; verify dashboard totals, budgets, reports, and CSV sharing.
- Confirm protected routes require sign-in and that two Supabase accounts cannot read or modify each other's records.
- Sign in, load data, switch to airplane mode, add/edit/delete a transaction and budget, close and reopen the app, then reconnect and confirm all changes appear in Supabase. Confirm no offline warning is shown.
- Use the top-bar refresh button online and confirm data updates; use it offline and confirm local data remains available.
- Test Android back navigation, keyboard visibility on forms, external links, and offline changes syncing after reconnect.
- Test the login/sign-up password visibility control, add an income and expense and confirm the current balance reflects both, and submit a Contact us message through the device email app.
- Test loans to repay and money lent offline, update and settle balances, and verify device reminders are scheduled only with permission.
- Create weekly, monthly, and yearly bills; mark one paid and confirm an expense is recorded and its next due date advances. Test reminders with the app offline.
- Create a shared split, mark participants settled, then export a backup and restore it to the same account; confirm existing matching records are not overwritten.
- Check transaction search across descriptions, notes, categories, and payment methods; filter by type, dates, and category. Verify monthly summary uses calendar-month boundaries.
- Repeat the app's website checks after deployment. Apply all migrations, then run `npm run test:rls:live` with the documented two-account environment variables to exercise live owner isolation.

## Common problems

| Problem | Check |
|---|---|
| `out` is missing during Capacitor sync | Run `npm run build:android` before `npx cap sync android`. |
| App shows Supabase configuration errors | Confirm both public environment variables are set before the Android export build; rebuild and sync after changing them. |
| Offline changes do not sync | Reconnect to the internet, reopen the app, and confirm the same account is signed in; pending changes sync when connectivity returns. |
| Confirmation link does not open the app | Confirm `spendwise://auth/confirm` is in Supabase's redirect allow list and the Android app is installed; request a fresh confirmation email. |
| Gradle reports missing SDK or Java | Install SDK Platform 36 / Build-Tools in Android Studio and configure Java 21. |
| Website route displays a not-found page in the APK | Keep `trailingSlash` enabled for the Capacitor export and rebuild/sync. |
| CSV sharing fails | Confirm the Android share sheet is available and retry; the app writes the export into its private cache before sharing. |

## Updating Capacitor or Android

After changing web assets or Capacitor plugins:

```powershell
npm run build:android
npx cap sync android
```

Open the native project with `npm run android:open`. Review Android Studio's suggested Gradle/SDK updates before accepting them, then build and test a new APK.
