# Browsing performance

The mobile browsing path no longer awaits analytics uploads before requesting reels or watch progress. Events continue to flush in the background and remain persisted in the existing queue. Progress reads reuse results for 15 seconds; local progress mutations still update the query cache immediately. Disk persistence runs separately from completing the film progress query.

Grid progress IDs change in 30-film blocks, rather than on every visible card. Film cells are memoized and list extraData follows progress data instead of the visible-card ID. A group of failed cover images can trigger only one catalogue refresh per 30 seconds, preventing retry storms.

The backend reuses a bounded public reel candidate snapshot for 30 seconds through the existing catalogue cache. Interest aggregation and candidate loading run concurrently. Viewer watch history, interests, saved lists and ranked session order stay viewer-specific; cached candidate rows contain no private progress. Episode libraries skip interest aggregation.

Local Docker API checks with 54 published films and the generated demo catalogue:

- Film grid: 6–10 ms warmed (first sampled request 43 ms).
- Reels: 22–28 ms warmed (first sampled request 46 ms); before the change, repeated new-session requests took 34–70 ms.
- Separate Windows LAN health checks: 20–50 ms warmed.

These timings do not measure phone Wi-Fi latency, frame rate, or production concurrency. Regression tests deliberately stall analytics indefinitely and verify that reels and progress still load. Further tests verify that public candidate caching does not share private watch history across viewers.
