# Module 24 — DECISIONS.md: Monetization

## Decision 1: Privacy-First Analytics as a Business Differentiator

NeuralTab's analytics_manager.js stores usage data locally — no server, no identifiers, no network requests. This isn't just ethical; it's a business differentiator. Users who have been burned by Honey/Grammarly/Stylish are increasingly analytics-aware. "Your data never leaves your device" is a marketing point worth featuring in the CWS listing description.

## Decision 2: Rolling 30-Day Window Prevents Storage Bloat

Analytics data is capped at 30 days of daily buckets. This bounds storage growth regardless of how long the extension is installed. Each day's bucket is a fixed-size object (event counts, not event logs), so even heavy users accumulate at most 30 small objects. The trade-off: no historical trend beyond 30 days — acceptable for an analytics primitive.

## Decision 3: License Validation Caching Prevents Excessive Server Calls

The `isPremium()` function in the license validation pattern caches the server's response for 24 hours in `chrome.storage.local`. Without caching, every feature use would make a network request — terrible for performance and server costs. 24 hours is a reasonable balance: a revoked license is detected within a day, and server load is proportional to DAU rather than feature usage frequency.

## Decision 4: Freemium Gating in Background, Not UI

License checking should happen in the background service worker (`isPremium()` message handler), not in the UI layer. If you gate features in the popup's JavaScript, a determined user can bypass it by injecting JS into the popup context. Background-enforced gating is harder to bypass because the user cannot execute arbitrary JS in the service worker.

## Decision 5: CWS Doesn't Process Payments — Use a Third-Party

Chrome Web Store's built-in payment system was deprecated. For paid extensions, use external payment processors: LemonSqueezy, Gumroad, Paddle, or Stripe. The extension validates a license key server-side (as shown in the pattern). This keeps payment infrastructure separate from the extension itself and avoids CWS policy complexity around in-app purchases.

## Decision 6: Donation vs. Subscription Psychology

Open-source donations (GitHub Sponsors, Ko-fi) have a 2-5% conversion rate from active users. Subscriptions with a meaningful free tier have 3-8% conversion. One-time purchase apps skew toward higher revenue per converted user but lower total conversion. For a 10,000 DAU extension, all three models can sustain development — the choice depends on whether you want predictable recurring revenue (subscription) or simplicity (donation/one-time).
