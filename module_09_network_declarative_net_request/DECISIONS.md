# Module 09 — Design Decisions

## Decision 1: declarativeNetRequest over webRequest for blocking

**Choice:** All blocking and redirect rules are defined statically in `dnr_rules.json` and loaded as a rule resource. Dynamic rules are not used for the default rule set.

**Why DNR over webRequest:**
- MV3 removed `chrome.webRequest` with blocking capability (`blocking` mode). It exists in MV3 only for observation. If you need to block a request, you must use `declarativeNetRequest`.
- DNR rules are evaluated by the browser's C++ networking engine before any JavaScript runs. This is faster than the JS event-loop path that `webRequest` uses.
- DNR does not keep the service worker alive to evaluate rules — the rules live in the browser. A webRequest blocking listener would need the SW active for every single network request on every tab.
- Privacy: DNR rules are inspectable by users via `chrome://net-internals/#events`. The Chrome Web Store requires DNR for new extensions that block requests.

**The webNavigation API (still present):**
`chrome.webNavigation` is observation-only and still works in MV3. NeuralTab uses it to log navigation events to the Network Monitor. It does not block anything — it is purely telemetry.

---

## Decision 2: Static rules in dnr_rules.json, not dynamic rules via updateDynamicRules

**Choice:** Rules 1–5 are declared in `dnr_rules.json` and listed in `manifest.json` under `declarative_net_request.rule_resources`.

**Rejected:** Loading all rules dynamically via `chrome.declarativeNetRequest.updateDynamicRules()` at install time.

**Why static rules:**
- Static rules are validated at install time by the Chrome Web Store and by the extension loader. A malformed static rule file fails loudly during development.
- Static rules survive extension updates without re-insertion. Dynamic rules must be re-inserted on every install/update.
- Static rules have a higher quota: 30,000 rules per extension vs 5,000 dynamic rules.
- The rule limit for static enabled rules visible to the user: 150 enabled at once. Dynamic rules do not count toward the static limit.

**When to use dynamic rules:**
User-configurable rules (custom block lists, allow-list overrides, per-domain exceptions). NeuralTab's Module 09 rule set is intentionally fixed to teach the static mechanism. A production ad blocker would use `updateDynamicRules()` to sync a user-maintained block list.

---

## Decision 3: Network events are capped at 500 in chrome.storage.local

**Choice:** `networkEvents` array is capped at 500 entries, stored in `chrome.storage.local`.

**Rejected:** Storing network events in IndexedDB alongside page visits.

**Why local storage for network events:**
- Network events are ephemeral monitoring data, not persistent history. The user does not need to search them across sessions. A 500-event rolling window covers ~1-2 minutes of browsing.
- IndexedDB write latency (~5ms per transaction) multiplied by the rate of network events (potentially hundreds per minute on a content-heavy page) would create a write queue backlog.
- The 500 × ~200 bytes per event = 100 KB maximum storage impact — acceptable for local storage.

**The rolling window:**
`if (evts.length > 500) evts.splice(0, evts.length - 500)` removes from the front. This is O(n) but n is bounded at 500, so the splice is always O(500). For higher-throughput monitoring, use a ring buffer with a fixed array and an index pointer.

---

## Decision 4: The toggle in Network Monitor enables/disables the entire ruleset

**Choice:** The "Block ad networks" toggle calls `chrome.declarativeNetRequest.enableRulesets(['neuraltab_rules'])` / `disableRulesets(['neuraltab_rules'])` to toggle the entire static rule set.

**Why ruleset-level toggle:**
- Individual rule enable/disable requires listing rule IDs via `updateEnabledRules()`. For a teaching demo with 5 rules, that is noisy.
- Ruleset enable/disable is a single API call that suspends all rules in the set atomically.
- This teaches the concept of ruleset groups — in a production ad blocker you would have separate rulesets: "social media trackers", "ad networks", "analytics" — each user-togglable independently.

---

## Decision 5: webNavigation events only for frameId === 0 (main frame)

**Choice:** `if (details.frameId === 0)` guards every webNavigation listener.

**Why main frame only:**
Every page load fires webNavigation events for the main frame (frameId 0) AND for every iframe embedded in the page. A typical news site with 4 ad iframes fires 5 `onBeforeNavigate` events per page load. Logging all of them would flood the network monitor with noise.
Main-frame events are what users think of as "navigation" — the URL bar changing. Sub-frame navigation is invisible to the user and clutters the monitor.

**Exception:** If you are building an iframe security monitor (module 22), you would specifically want `frameId !== 0` to detect suspicious iframe loads.
