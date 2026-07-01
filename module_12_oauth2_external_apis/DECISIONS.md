# Module 12 — DECISIONS.md: OAuth2 & External APIs

## Decision 1: launchWebAuthFlow vs. getAuthToken

Chrome provides two OAuth APIs: `chrome.identity.getAuthToken` (Chrome-only, uses the user's Chrome sign-in) and `chrome.identity.launchWebAuthFlow` (universal, works with any OAuth2 provider). NeuralTab uses `launchWebAuthFlow` because it works with any provider and doesn't require the user to be signed into Chrome with Google.

**Trade-off:** `getAuthToken` is simpler for Google APIs (no client_id in manifest, no redirect URI setup), but locks you into Google. `launchWebAuthFlow` requires a registered OAuth app and redirect URI setup.

## Decision 2: The Implicit Flow for Extension OAuth

NeuralTab uses the implicit flow (`response_type=token`) which returns the access token directly in the redirect URL fragment. The alternative is the PKCE authorization code flow, which is more secure but requires a server to exchange the code for tokens.

**Why implicit:** Extensions are client-side only. There's no server to keep a client secret. The redirect to `https://<ext-id>.chromiumapp.org/` is cryptographically tied to the extension — only the installed extension can read that redirect. This makes implicit flow acceptable for extensions despite being deprecated for web apps.

## Decision 3: Token Storage in local vs. sync

The OAuth token is stored in `chrome.storage.local`, not `sync`. Tokens should not sync across devices because they are device-bound sessions. If a token stored in sync is revoked on one device, the stale token on another device causes confusing 401 errors.

## Decision 4: Token Refresh Strategy

OAuth access tokens expire (typically 1 hour for Google). NeuralTab's auth_manager doesn't implement refresh tokens because the implicit flow doesn't return refresh tokens. The correct response to a 401 is to call `login()` again — `launchWebAuthFlow` with `interactive: false` will silently re-authenticate if the user's Google session is still active.

## Decision 5: No PKCE for Extension OAuth is a Known Trade-off

Security purists will prefer PKCE even in extensions. The case for it: if somehow the extension ID is predictable, an attacker could register a malicious extension with the same ID and steal the auth code. In practice, extension IDs are cryptographically tied to the signing key, making this attack implausible. We document this decision so teams can upgrade to PKCE if their threat model requires it.

## Decision 6: API Call Caching

auth_manager doesn't cache API responses. The `getUserInfo()` call goes to the network every time. In production, cache the user object in `storage.session` with a 5-minute TTL to avoid hammering the API on every popup open.
