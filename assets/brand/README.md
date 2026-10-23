# Koreva reference design

The mobile interface follows the supplied Koreva marketing reference: midnight navy, violet-to-magenta actions, a neon film-ribbon mark, cinematic film covers, rounded genre tiles, and a quieter bottom navigation bar. Film covers and catalogue content remain real API data.

## Assets

- `mark.png`: transparent 512px mark used in app headers and launch.
- `icon.png`: opaque 1024px store/app icon.
- `adaptive-icon.png`: transparent mark with Android adaptive-icon safe padding.
- `launch.jpg`: optimized 960×1440 cinematic launch artwork (83 KB).

The logo and launch artwork were generated with the built-in image-generation tool, using the user's supplied image as a style reference. Icons are derived from the generated mark. These are bundled local assets; launch does not fetch artwork or wait for the API. The launch overlay fades away after asset preparation, honors reduced motion, and releases navigation if preparation fails. No forced minimum loading time.

## Generation prompts

### Mark

Use case: logo-brand. Create a single polished Koreva app logo symbol as a transparent PNG, no words or letters. Reference image is a style reference only: emulate the luminous triangular film-ribbon play symbol shown in the left column. A continuous rounded triangular film strip, pointing right, forming an open dark/transparent triangular play aperture, glossy dimensional ribbon with small rectangular film sprocket perforations. Electric blue on left and lower edge, vivid violet and hot magenta on upper/right strip, restrained soft neon glow. Centered isolated symbol, generous transparent padding, square canvas, smooth precise silhouette legible at 32px. No background, no people, no text, no phone UI, no additional symbols. This will be Koreva's app icon and splash logo.

### Launch artwork

Use case: illustration-story. Asset: a portrait background artwork for the Koreva short drama mobile app launch screen. Use the supplied marketing collage as a mood and palette reference only. Create a premium cinematic romantic fantasy still: a handsome adult dark-haired man and an adult woman with long dark wavy hair facing one another, intimate but fully clothed, dramatic near-profile close up in the top 40% of image. Distant softly blurred enchanted city / castle, midnight purple and electric blue rim lighting with faint magenta glow, luxurious photorealistic film poster finish. Portrait 2:3. The lower 60% must fade smoothly into near-solid deep navy #050518 for clean logo and copy overlay in the app. Keep faces entirely in upper 40%; no text, no logo, no UI, no frames, no phones, no watermark. Lower section very dark calm negative space.

## Testing

Restart Metro with `npm start -- --clear`, then open Koreva in Expo Go. Close and reopen the app to check the in-app launch screen. The standalone native splash and installed icon are configured in `app.json`; Expo Go does not reproduce the final native launch experience. See [Expo splash-screen guidance](https://docs.expo.dev/versions/latest/sdk/splash-screen/).

No APK build or Expo account linkage was performed for this redesign. Offline downloads, comments, and sharing advertised in the reference are not implied by this visual update.

## Launch handoff update

The app-rendered launch is now one full-screen artwork with a small header and loading indicator. The native splash is hidden only after the image's native load/decode event, which prevents a logo-only app frame while the photo is decoding. A five-second failure cap releases navigation if decoding or asset preparation never settles; normal launches have no minimum delay.

The iOS config uses Expo's supported full-screen image legacy option for the native launch image. This is a transitional option and may need revisiting when upgrading Expo. Native changes take effect in a future standalone build, not a Metro reload.

Expo Go controls its own icon/name screen before JavaScript runs. Android 12+ mandates an icon and solid-color system splash; a full-screen photograph with an animated spinner cannot replace that OS stage. Koreva's artwork appears at the first app-rendered stage, after the required system/Expo stage.
