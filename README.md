# Koreva mobile — Expo

Expo SDK 57 with React Native 0.86.3 and React 19.2.3. The existing catalogue, film parts, HLS playback, guest sessions, progress and analytics remain integrated. Video uses expo-video; guest credentials use expo-secure-store. No signup is required in Koreva.

## Test with Expo Go

Install Expo Go on your Android phone. Start the Koreva backend and publish a ready film from admin so it appears in the catalogue.

### USB (existing localhost backend)

Connect one phone, enable USB debugging and authorize your computer. Run:

```powershell
cd C:\Users\Jbujb\Desktop\ai\mobile-app
npm run start:usb
```

This forwards ports 8081, 3000 and 59000 and starts Expo only. Open the displayed Expo link in Expo Go on the connected phone. It does not compile or install an APK. Android platform-tools are needed for USB forwarding; no JDK or native compiler is required.

### Wi-Fi

Put your computer and phone on the same network. Copy .env.example to .env and replace YOUR_PC_LAN_IP with your computer's local IP. Configure the backend API_BASE_URL, S3_PUBLIC_ENDPOINT and CDN_BASE_URL to use hosts reachable from the phone, then restart the affected backend services. The default localhost endpoints only work with USB forwarding. Do not rewrite signed storage URL hosts in the app.

```powershell
npm start
```

Scan the QR code with Expo Go. Allow the development ports through Windows Firewall if needed. Use an Expo Go version compatible with SDK 57: https://expo.dev/go . After changing .env, restart Expo with npm start -- --clear.

## Configuration and checks

EXPO_PUBLIC_API_URL is public app configuration, never a secret. Production requires an HTTPS API and publicly reachable HTTPS playback/storage endpoints. The application identifier is com.filmstream.mobile.

```powershell
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo install --check
```

Native scaffolds from the previous bare React Native project are preserved in native-legacy and excluded from Expo/Metro. No native or store build is part of this conversion. A separate signed production build will be needed for Play Store distribution later.

## Existing behaviour

Parts open in a portrait, full-screen reel view. Swipe up (bottom to top) for the next part and down (top to bottom) for the previous part. Tap the centre to pause or resume. The native pager follows your finger and snaps to one full-screen part. A back icon and a compact bottom caption remain visible, with a small heart and part view count. Parts autoplay on entry. Double-tap the centre to love; double-tap the left or right edge to rewind or advance five seconds. The right action rail contains love, views, save and mute controls. Film title and an expandable description appear at the bottom. Save a whole film from its detail screen or a part from its reel; the home bookmark opens your saved collection. Saves sync with the backend and survive reloads. Film cards and details show film views, and the part list shows part views. Only the current part has a native video player; leaving it releases the player and saves progress. The next playback grant is prefetched without creating another decoder. Landscape source films retain their aspect ratio.

For Wi-Fi, filmstream/.env can set FILMSTREAM_PUBLIC_HOST to your computer's local IP. The Docker Compose public API and storage endpoints use that host; restart API, worker and scheduler without rebuilding after a host change. For localhost-only USB use, set FILMSTREAM_PUBLIC_HOST=localhost instead.

Catalogue requests are cursor-paginated, search is debounced and lists are recycled. Metadata stays cached for back navigation. Parts stream their existing shared-film HLS ranges; there are no additional uploads or video cuts. Positions are stored locally and playback pauses when the app is inactive. Short-lived playback grants renew while watching. Guest rotation persists its retry key securely before sending; banned or revoked guests are not replaced automatically.

Free parts play directly. Premium and rewarded-ad parts retain backend restrictions and permitted previews; payment and rewarded-ad integrations are not included. Streaming requires a connection. Physical-device playback and production performance still require testing.

Views count distinct guest users after playback starts, once per film and part. Guest recovery keeps the same identity when refresh credentials expire. Clearing app storage or reinstalling can create a new anonymous identity; existing duplicate users are not merged by IP.


The display name is Koreva. Keep the internal Expo slug filmstream and secure session key unchanged: Expo Go isolates project storage using the project scope, so changing the slug starts a separate guest identity. Normal reloads reuse persisted credentials; corrupt saved identity is reported instead of silently creating another guest. Restart Expo after configuration changes.

## Home discovery

Home uses compact two-column film cards with title, view and love counts over the artwork. Horizontal category chips below search filter the server-paginated catalogue by genres. Pull to refresh reloads both films and categories.

Choose categories in Admin > Film > Metadata > Categories. Choose one existing part in Admin > Film > Parts > Home screen trailer; no additional upload or cut is needed. Films without a selected trailer retain their poster. The focused card plays up to 30 seconds silently after 500 ms of stable visibility. Only one native preview player is mounted; leaving focus, navigating away or backgrounding releases it. Locked parts require an enabled backend preview. Preview activity is recorded separately from full part views and does not overwrite watching progress.
Parts start from 0:00 whenever opened, rather than restoring an earlier viewing position. Renewing an expiring playback grant within the same reel preserves its current position. Autoplay waits for native readyToPlay, and premature native completion events are ignored. Each episode displays its exact duration; reels show elapsed/total time and a slim progress indicator.

Reels use contain: the entire video stays visible on any phone while preserving its proportions, with space around it when source and screen shapes differ. For a portrait reel filling most of the screen, upload a 9:16 original (for example 1080x1920 or 720x1280). Landscape originals such as 1920x1032 have space above and below on portrait phones; the sides stay fully visible. The existing backend generates adaptive HLS resolutions while preserving aspect ratio; multiple phone-specific uploads are unnecessary. cover can fill the screen by cropping the sides; avoid fill, which distorts the picture.

Paused reels expose single-tap -5s and +5s buttons around the play control, and seeking preserves the paused state. The full-width bottom progress line uses separate elapsed and duration labels. Finished parts show a Part finished / Watch again state; replay resets the native player to exactly zero and resumes immediately. Loading spinners are suppressed for paused/finished reels.

Watch history appears as completed-part counts on home cards and film details, plus per-part and whole-film progress bars in details. Partial parts show their furthest watched time; finished parts remain watched after replay/rewind. History persists locally and on the authenticated backend. Summaries are batched for catalogue films, refreshed on navigation/manual refresh, and never polled. Previews do not mark full parts as watched.

## Home, Reels and Saved

The app now has three bottom tabs. Reels mixes clips from different films, learns category interests from watching/loving/saving, and includes discovery clips. Swipe up for next and down for previous. Use Explore beside the love/save/mute controls to open that clip's film. Saved separates saved films/parts from saved reels.

To add discovery content: Admin > Films > open a ready film > Reels > select a start/end range (up to 180 seconds) > enter metadata > Save reel. The film must be published. Show/Hide controls each clip. Existing film parts are not automatically added to discovery, and no extra video is uploaded.

After updating dependencies, restart Expo with npm start -- --clear and reopen the app in Expo Go. No native build is required for these changes.

## Profile and accounts

Open Profile to create an account from the current guest session or sign in on another phone. Sign-up keeps the current user ID and all activity. Sign-in merges that phone's guest saves, loves and progress into the account; both phones can stay signed in. Sign-out affects only the current phone and clears its private local history while preserving the account's server data.

Profile also edits the display name and switches English, Français or العربية. The preference follows the account across devices. Arabic uses right-to-left layout; publisher film titles/descriptions retain their original language. Passwords require at least 12 characters. Email verification/password reset are not yet available.

Selected trailers now autoplay muted in the focused home card and film details, and loop within their preview range. Admin must choose a published playable trailer part for each film.

### Film presentation and Saved

Saved has three collections: Films (explicit film saves), Episodes, and Reels. Saving an episode never implicitly saves its whole film. Save status is fetched again when opened; mutations cancel older reads and refresh the correct collections. The Home header has no duplicate Saved shortcut.

Trailers are separate uploaded video assets selected in Admin → Films → Presentation. They never appear in episode lists or watched-episode totals. Home cards use the selected trailer playback endpoint. Film details display no trailer. Uploaded covers appear on film cards and details; when absent, the full film’s generated poster is used.

## EAS Android builds (configured, not linked)

No Expo account, owner, EAS project ID, signing key, or cloud project is configured by this setup. No build has been started. EAS CLI runs through npx when you deliberately execute a build command.

- Installable standalone APK: npm run build:apk (apk profile). The APK bundles JavaScript and does not require Metro or Expo Go.
- Google Play Android App Bundle: npm run build:android:store (production profile).

Expo cloud builds require an Expo account and linked project. When you decide to use cloud builds, run npx eas-cli@latest login, then npx eas-cli@latest init to choose your account/project, followed by npm run build:apk. These commands have not been run here.

.easignore excludes legacy native projects, local build outputs, signing credentials, tests and caches. It includes the current .env, which contains only EXPO_PUBLIC_API_URL, so the bundled app uses that address. Set it to the backend URL reachable from the phone before building; it is compiled into the APK. For a release APK, use HTTPS for the API and media URLs. Never add private keys or credentials to EXPO_PUBLIC variables or this uploaded .env.

Reference: https://docs.expo.dev/build-reference/apk/ and https://docs.expo.dev/build/setup/

Home places the current viewer’s most recently watched published episode film first without duplicating it in the catalogue. Watch history is refreshed when Home gains focus; search, category filters and Saved retain their own ordering. Reels, trailers, hidden films and other viewers’ history are excluded.

Home presents the last watched film in a separate full-width Continue watching card with a Last watched badge and progress bar. Other films remain in the compact two-column grid. Popular ranks by views, Famous by loves, and New by publication date; Categories reveals available genres only when selected. Backend ranking uses indexed keyset pagination.

Home supports horizontal browse gestures: swipe from right to left to move Popular → Famous → New → Categories, and from left to right to return. Vertical film scrolling remains available. The compact 124-pixel last-watched card appears only under Popular, with video on the left and information on the right, without a separate Continue watching heading.

Home uses react-native-pager-view for native page transitions with an explicit left-to-right page layout, preserved per-tab vertical scroll, bounded adjacent-page metadata preload, and paused video previews during transitions. After adding the pager dependency, restart Metro with npx expo start --go --clear. No APK build or account linking is required to test it in Expo Go.
