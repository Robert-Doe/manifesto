# Module 16 — DECISIONS.md: Side Panel API

## Decision 1: setPanelBehavior({ openPanelOnActionClick: true })

By default, clicking the extension action icon opens the popup. To make it open the side panel instead, call `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` in `onInstalled`. This is a global setting that replaces the popup — if you want both, you need to manage the toggle yourself via `chrome.action.onClicked` listener.

## Decision 2: Side Panel Persists Across Navigation

Unlike popups (which close on navigation), the side panel stays open as the user navigates. This makes it ideal for features that need to observe or react to browsing behavior: history tracking, reading mode, research assistants, page analysis. NeuralTab's side panel shows a live navigation feed precisely because of this persistence.

## Decision 3: chrome.sidePanel Requires Chrome 114+

The `sidePanel` API was introduced in Chrome 114 (May 2023). Declaring it in manifest.json on older Chrome versions causes a graceful degradation — Chrome ignores unknown manifest keys. But calling `chrome.sidePanel.open()` on an older Chrome will throw. The `NTCompat.hasSidePanel()` helper from Module 17 is the correct guard.

## Decision 4: Context Menu as Side Panel Opener

We register a context menu item ("Open NeuralTab Panel") in `onInstalled` to give users a right-click path to the side panel. This is the canonical discovery pattern — users who have disabled the action icon popup can still access the panel via right-click. The context menu item is created once and persists; recreating it on every SW start causes "duplicate key" errors.

## Decision 5: Communication Between Panel and Popup

Side panel and popup are separate HTML pages that don't share a DOM. Communication between them goes through: (1) `chrome.runtime.sendMessage` for request-response, (2) `chrome.storage.onChanged` for reactive state (Pattern 4 from Module 06). NeuralTab's panel uses `storage.onChanged` for the navigation feed — it reacts to `networkEvents` changes written by the background SW.

## Decision 6: Side Panel vs. Offscreen Document for Background Processing

Side panel pages remain alive while visible (unlike popups). This makes them suitable for holding long-lived state, rendering charts, or running periodic updates. They are NOT a replacement for offscreen documents — offscreen documents are headless and can run even when the panel is closed. Use the panel for UI; use offscreen for invisible background processing.
