# Home, discovery and sharing

Home keeps the Koreva logo and purple palette and a top-right search button. Admin-managed For You, Hot, New and custom categories replace shelves and See all buttons. Each category uses a three-column, cursor-paginated grid. Titles, genre, views, loves and watched progress sit below posters. Cards never request trailer playback on focus. For You has a compact full-width last-watched card, progress and Continue watching action. Native horizontal paging drives the tab indicator and selected-label transition; tapping a tab uses that same pager animation. Adjacent categories preload one page, and visited lists retain their scroll positions. Saved films keep their separate list.

## Categories

Open Categories under Catalogue in the admin sidebar. Create or edit the name, ranking (most viewed / newest / most loved), optional exact genre filter, display order and visibility. Published visible films matching that genre populate automatically; edit film genres from Films. For You cannot be removed, hidden or genre-restricted. Reads require film:read and writes require film:write with a live admin session, idempotency and audit logging. Public category definitions cache for 30 seconds and invalidate after each change. Viewer history is never shared in that cache.

## API

- `GET /v1/home/categories`: active tabs in admin-defined order.
- `GET /v1/home/categories/:id/films?limit=20&cursor=...`: resolves the enabled category and applies its ranking and genre on the server using the existing paginated catalogue cache.
- `GET /v1/admin/categories`, `POST /v1/admin/categories`, `POST /v1/admin/categories/:id`, `DELETE /v1/admin/categories/:id`: authenticated category management.

- `GET /v1/home?genre=Drama`: device/user authenticated; returns all published categories, the current viewer's last-watched film (For you only), and three shelves of up to six films. Public shelves reuse the existing 30-second catalogue cache. Private history is queried separately and never enters a shared cache.
- `GET /v1/films?sort=popular|new|famous&genre=Drama&limit=20&cursor=...`: existing keyset pagination for See all and search. Trending ranks by views, Most loved by loves, New releases by publication date.
- `GET /v1/films/:filmId/parts/:partId/share`: validates UUIDs, published film/part visibility, part ownership and ready media; returns film, selected part, the separate episode list and a stable `koreva://watch/:filmId/:partId` URL. Trailers, unpublished reels, unavailable assets and hidden films cannot be resolved. It never returns a playback grant.

## Player

Both reels and episodes have love, save, Share and mute on the right; discovery reels also have Explore film. Tap the center to pause, double-tap the center to love, double-tap either side to seek five seconds. While paused, explicit seek controls appear. Tap the timeline to seek; accessibility increment/decrement actions seek five seconds. Finished episodes offer Watch again and Next episode when the next episode is playable. Videos retain contain fitting so the complete original image stays visible.

Sharing opens the platform share sheet and temporarily pauses the player. Analytics records opening/dismissing/closing the sheet, not confirmed delivery: Android does not report whether a recipient received it. Incoming links resolve the original episode or reel and use the normal playback access checks.

## Test

Reload Expo Go to test Home and the player. Test the share sheet without sending to anyone by opening it and cancelling. The `koreva://` receiving link requires an installed Koreva app with its configured scheme; Expo Go does not register that custom scheme. A public HTTPS universal link, browser fallback and store redirect require a production domain and published app URLs, which are not configured here. No APK was built and no Expo account was linked.

The player uses one bottom footer for metadata and progress. Fullscreen playback applies the gesture inset once; feed and Saved playback reuse the space already reserved by the tab bar. The action rail follows the measured footer height. Native video-track dimensions size the original video without cropping, while a blurred film cover fills the surrounding space.

Refresh uses explicit buttons on Home, Saved films, film details and reels. Film lists and details have no pull-to-refresh gesture. Vertical scrolling still loads the next page without resetting the current list.

Episode terminology is used throughout visible labels and accessibility text. View counts are hidden on reel/episode players and episode rows. Action labels use a 76-point column with centered wrapping and no line truncation, including French and Arabic.
