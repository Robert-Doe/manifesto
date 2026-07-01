# Module 23 — DECISIONS.md: Autopsy III (CWS Removals)

## Decision 1: Real Case Studies Build Practical Intuition

The CWS removal cases in Module 23 (The Great Suspender, DataSpii, Stylish, session replay batch) are all public knowledge, documented by security researchers and journalists. Teaching from real incidents is more effective than hypothetical scenarios because the consequences (users harmed, developers banned, extensions force-disabled) are concrete.

## Decision 2: Force-Disable vs. Removal Are Different Severities

When Chrome force-disables an extension (as with The Great Suspender), all installed copies are remotely disabled and Chrome shows a security warning. When Chrome removes from the store, existing installs continue working but no new installs are possible. Force-disable is reserved for active security threats; removal is for policy violations. Developers should understand both paths.

## Decision 3: The Privacy Practices Dashboard Is Now Mandatory

Since 2021, CWS requires all extensions to complete the "Privacy practices" tab in the developer dashboard. This includes: what data is collected, what it's used for, whether it's sold, and whether it stays on device. Incomplete privacy practices cause submission rejection. This was a direct policy response to the DataSpii and Stylish incidents.

## Decision 4: Obfuscation Is the Fastest Path to Rejection

The CWS policy explicitly prohibits obfuscation (not minification). Google's automated review uses static analysis to detect obfuscation patterns: encoded string concatenation, eval of decoded strings, variable names that are single characters in deeply nested closures. If your legitimate minifier produces code that looks obfuscated, whitelist your extension for human review proactively.

## Decision 5: Acquisition Creates a Policy Accountability Gap

When The Great Suspender was sold, the malicious update passed CWS review because the extension already had an established trust history. Google has since tightened review of updates from accounts where ownership recently transferred, but the gap persists. The lesson for users: re-audit extensions after ownership changes. The lesson for developers: if you sell an extension, document it publicly.

## Decision 6: CWS Review Times Vary by Permission Profile

Low-permission extensions (storage only, no host_permissions) typically review in 24-48 hours. Extensions requesting `debugger`, `<all_urls>`, `nativeMessaging`, or `identity` go to manual review and can take 1-3 weeks. Plan your release schedule accordingly. First submissions take longer than updates. Major permission additions in an update trigger re-review.
