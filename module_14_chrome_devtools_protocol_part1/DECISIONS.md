# Module 14 — DECISIONS.md: Chrome DevTools Protocol Part 1

## Decision 1: chrome.debugger vs. Native CDP WebSocket

There are two ways to speak CDP in a Chrome extension: `chrome.debugger` API (requires the `debugger` permission, handled by Chrome) or connecting to `chrome://inspect` via WebSocket. Extensions use `chrome.debugger`. The WebSocket approach requires the browser to launch with `--remote-debugging-port` and cannot be done from a normal extension.

## Decision 2: The Infobar is Intentional and Unremovable

When an extension attaches the debugger to a tab, Chrome shows an orange infobar: "DevTools is connected." This cannot be suppressed or hidden. It's a deliberate security feature so users know their tab is being debugged. Build your UX around the assumption that users will see this banner — make it clear in your extension's UI that debugging is active and why.

## Decision 3: One Attachment at a Time Per Tab

The `chrome.debugger.attach({ tabId }, '1.3')` call will fail if another debugger (including Chrome DevTools) is already attached to that tab. NeuralTab tracks `attachedTabId` and detaches before attaching to a new tab. In production, handle the `chrome.debugger.onDetach` event (fired when DevTools opens) to update state.

## Decision 4: CDP Protocol Version '1.3'

We attach at protocol version `'1.3'`. Chrome supports multiple CDP versions but `'1.3'` is the stable, widely-supported version that covers all common use cases. Using `'1.2'` works too; using a future unreleased version string will fail. The version string is validated but Chrome may support more commands than the declared version suggests.

## Decision 5: sendCommand Returns Protocol-Defined Results

`chrome.debugger.sendCommand` returns a Promise that resolves to the CDP method's result object. For `Runtime.evaluate`, the result has a `result` property of type `Runtime.RemoteObject`. Always check for `exceptionDetails` in evaluate results — an exception in the evaluated code does not reject the Promise.

## Decision 6: Security Implications of the debugger Permission

The `debugger` permission is the most powerful in Chrome extensions. A debugger-attached extension can read all JS memory in the tab, intercept and modify all network requests, execute arbitrary JS, read all cookies, and take screenshots. CWS review scrutinizes this permission heavily. Always document why you need it in your listing description and only request it when genuinely required.
