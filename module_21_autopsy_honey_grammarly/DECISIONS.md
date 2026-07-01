# Module 21 — DECISIONS.md: Autopsy I (Honey & Grammarly)

## Decision 1: Case Studies Are Based on Public Documentation

The Honey affiliate hijacking analysis is based on the December 2024 MegaLag YouTube investigation and subsequent reporting. The Grammarly analysis is based on Tavis Ormandy's 2018 Project Zero disclosure and public CWS permission analysis. All technical reconstructions are illustrative — exact implementation details may differ from the real extensions.

## Decision 2: "Legally Compliant but Ethically Problematic" Is the Key Distinction

Neither Honey nor Grammarly is malware. Both disclose their data practices in terms of service. The lesson: Chrome Web Store policy compliance and ethical behavior with user data are different thresholds. Extension developers face a choice: optimize for what you can get away with, or optimize for user trust. The long-term business case for trust is better — Grammarly's enterprise sales depend on it.

## Decision 3: Affiliate Cookie Replacement Is Disclosed in ToS

Honey's affiliate replacement is technically disclosed on page 47 of their ToS. The CWS requires disclosure — it doesn't require prominent disclosure. This is why Module 21 teaches developers to read ToS carefully before installing extensions, especially ones offering "free" value in exchange for browsing data.

## Decision 4: Grammarly's Permission Scope Is Proportional to Its Function

`<all_urls>` is necessary for Grammarly's feature — it needs to inject into every page to check text everywhere. The permission is justified. The risk is the attack surface: 10 million users' keystrokes flowing through Grammarly's infrastructure is a target. One supply-chain compromise of Grammarly would be catastrophic. Proportional permission ≠ acceptable risk.

## Decision 5: NeuralTab Uses <all_urls> Too — Justification Required

NeuralTab also requests `<all_urls>` for content scripts and webNavigation. The CWS listing for a production NeuralTab would need to explicitly explain why. The acceptable answer: "NeuralTab tracks page visits with your permission. No data leaves your device. History is stored locally in IndexedDB." The key differentiator from Grammarly and Honey: local-only storage.

## Decision 6: The Acquisition Risk Is Real

Both The Great Suspender (Module 23) and Honey demonstrate what happens when extensions are acquired. The original developer's principles don't transfer. NeuralTab being open source partially mitigates this — users can audit the code post-acquisition. Including a prominent "this extension's code is open source at URL" in the description is a trust signal worth adding.
