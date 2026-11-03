# Security Notes

This document tracks security hardening done on LPTicket and known follow-ups.

## Dependency hardening prepared locally - 2026-11-03

Status: locally validated and publication authorized. Verify the active Railway commit before declaring the production rollout complete.

- Web: Next.js 16.4.5, sharp 0.35.5 and compatible transitive patches. The production dependency audit changed from 2 critical / 7 high / 1 moderate package entries to zero reported entries.
- Backend: compatible NestJS 11 / Fastify patches, updated mail/image dependencies, and targeted overrides for Fastify 5, Busboy 3, Joi 17 and brace-expansion 1. Removed the unused `@nestjs/serve-static` dependency; the existing direct Fastify static registration remains. Production audit changed from 14 high / 5 moderate entries to 5 moderate entries and no critical/high entries.
- Backend and web Docker images use Node 22 LTS. Backend build and all 354 tests passed on Node 22. Additional isolated checks covered multipart middleware and Nest/Fastify plugin initialization/static file serving; neither connected to production data. The web production build also passed on Node 22.
- Mobile: only compatible transitive security patches; native Expo / React Native package versions are preserved. iOS native fingerprint remains `ea1299b77d573e3358ca94477fec2f3b2ccc8760`. TypeScript, 42 recovery/door-sale tests and an iOS JavaScript export passed. Full npm audit changed from 1 critical / 14 high / 13 moderate / 2 low entries to 3 high / 13 moderate / 2 low entries.
- Remaining mobile high entries concern Expo CLI, its Zod 3 dependency and Metro's image-size 1 dependency. They are build/development tooling. Do not apply npm's suggested incompatible Expo SDK downgrade/upgrade or force Zod 4 into a Zod 3 consumer. A coordinated toolchain upgrade is still required. Audit entries include affected parent packages and are not independent exploit counts.
- Remaining backend moderate entries concern glob/minimatch and affected parent packages. Forced framework/ORM downgrades are not an acceptable audit fix.
- GitHub dependency alerts, security-update proposals, malware alerts, private vulnerability reports, secret scanning and push protection were enabled. CodeQL JavaScript/TypeScript completed successfully and initially raised 17 findings for review. Swift default analysis could not build an Xcode project and requires separate native build configuration. Findings are not evidence of exploitation.
- Apple mobile login now verifies the signature against Apple HTTPS public keys, issuer, exact mobile bundle audience, expiry, subject and verified signed email. A client-supplied email cannot choose the account; inactive accounts are rejected. Public keys are cached for 15 minutes and retrieval has a 5-second deadline. Local tests use ephemeral signing keys and cover forged/unsigned tokens, wrong issuer/audience, missing/expired claims and network failure. Real-device Apple login remains to be checked.
- OAuth callback state must be a string. Web login/registration destinations are normalized and restricted to the same origin; event purchase route parameters are encoded. Administrative generated passwords use browser cryptographic randomness. Seat selections are real arrays bounded to 100 entries before database access. Marketing preheaders are escaped as text.
- The backend image removes development dependencies after building; multer is retained as a runtime dependency because the upload controllers import it.
- Private dispute evidence and generated review artifacts are excluded from Git so customer/payment documents cannot be included accidentally in the public repository.

This review is not proof that an intrusion never occurred. Runtime access controls, account access history and provider notifications must be distinguished from dependency advisories. Existing browser-token storage and production database certificate validation still require separate integration work; this dependency patch does not alter authentication or database connectivity.

## Done

- **Registration privilege escalation closed** — `role` is never accepted from
  the client; self-registration is always `CLIENT`.
- **IDOR fixed** — event sales, attendees, scanner-stats and special-codes are
  now ownership-checked (only the organizer or an admin can read them).
- **No insecure secret fallbacks** — the server refuses to boot in production
  without `JWT_SECRET` / `JWT_REFRESH_SECRET`; session secret must be ≥ 32 chars.
- **CORS allow-list** — explicit origins via `APP_URL` / `CORS_ORIGINS` (mobile
  has no Origin header and is allowed).
- **Rate limiting** — global throttling + strict limits on auth endpoints
  (`@nestjs/throttler`); Stripe webhook is exempt. Returns `Retry-After`.
- **Security headers** — `@fastify/helmet` (HSTS in prod, nosniff, frameguard).
- **No internal error leakage** — exception filter hides stack traces / internal
  messages in production.
- **Ticket lookup access-controlled** — the normal ticket route requires JWT
  and ownership/event authorization. Only Tap to Pay door sales can create a
  time-limited HMAC guest link; it returns a sanitized single-ticket view and
  never grants scanning, account, contact or payment privileges.
- **XSS in JSON-LD** — `<` is escaped so a crafted event title can't break out.
- **429 UX** — web and mobile show a friendly "try again in N seconds" message.
- **Door-sale delivery authorization** — only an admin, the event owner, or an
  approved event employee can send a paid order's ticket after Tap to Pay.
- **Minimal delivery audit** — phone/email recipients are masked and matched
  through a truncated SHA-256 fingerprint; full contact values are not copied
  into the order delivery log.
- **Single operational ticket copy** — Tap to Pay sends one administrative
  record through `TICKET_ARCHIVE_EMAIL`; a later customer delivery suppresses internal
  BCC recipients so the same operational copy is not duplicated.
- **Atomic gate validation** — a ticket changes from active to used in one
  conditional database update, preventing simultaneous double admission.
- **Irreversible ticket revocation** — only the owning organizer or an admin
  can revoke event tickets. Ticket invalidation, seat release/permanent block,
  saved-map synchronization and immutable audit creation share one pessimistic
  database transaction; repeated requests cannot reactivate or duplicate the
  revocation, and orders or financial records are never rewritten.
- **Admin-created scanner requests are scoped** — an administrator may create
  a pending scanner-access request for an active user and a published event.
  The route requires JWT plus the admin role, the service repeats the role
  check, and the existing access record identifies the administrative actor.
  It does not impersonate the user or modify the event, inventory, tickets,
  orders, prices, payments, or organizer ownership.

## Gate admission and Tap to Pay — local implementation, 2026-09-15

Status: `IMPLEMENTADO`; backend deployed, physical-device payment and real gate-flow validation pending.

- Admission audit fields are written with the existing conditional active-to-used update. The server determines actor/time; DTOs only allow the manual or QR method. Historical records remain nullable. Revoked/cancelled tickets cannot be admitted and are excluded from available balances.
- Buyer search returns only operational fields and masked contact references, with no QR image or user credential fields. Existing event-specific authorization applies.
- Tap payment recovery checks operator/event ownership, the exact order/PaymentIntent pair, amount, currency and metadata before completion or cancellation. Capture response must actually be succeeded. An old client never receives a 2xx pending response from the legacy completion endpoint.
- Pending purchase storage is isolated by operator and contains only identifiers and sale summary, never a client secret or card/contact data. Network uncertainty does not clear it or automatically create another charge. Explicit retries reuse the original intent. Cancellation never rewrites a paid order.
- An isolated temporary PostgreSQL database verified exactly three nullable ADD statements, preserved historical ticket values, and accepted only one concurrent admission. Production deployment was explicitly authorized on 2026-09-15; physical payment validation remains pending.

## Known follow-up: tokens in localStorage → httpOnly cookies (deferred)

**Status:** intentionally deferred (low ROI for the risk).

Today the **web** stores `accessToken` / `refreshToken` in `localStorage`, which
is readable by any successful XSS. Moving them to `httpOnly` cookies would make
them unreadable from JS. It was deferred because:

- **Mobile gains nothing.** React Native has no browser DOM; requests use a
  `Authorization: Bearer` header from `AsyncStorage`. httpOnly cookies don't
  apply, so the backend would have to support **both** schemes at once.
- **It touches the most critical flow (login) in all 3 projects**, including the
  OAuth redirect (`/login/success?token=...`), the axios interceptor, and any
  SSR that currently reads the token client-side.

If/when this is done, the safe plan is:

1. Backend: on web login/refresh, also `Set-Cookie` httpOnly+Secure+SameSite=Lax
   for access/refresh; keep returning tokens in the body for mobile.
2. Add CSRF protection for cookie-authenticated state-changing requests
   (double-submit token or SameSite=strict where feasible).
3. Frontend: read auth from cookies (server components / middleware), drop
   `localStorage` token reads; rework the OAuth success handler to have the
   backend set the cookie and redirect (no token in the URL).
4. Keep mobile on Bearer/`AsyncStorage` unchanged.
5. Verify: email+password login, OAuth login, refresh, logout, SSR-protected
   pages, and mobile login all still work before removing the localStorage path.

Until then, the main mitigation is keeping the app XSS-free (no unsanitized
user HTML; the one `dangerouslySetInnerHTML` for JSON-LD is escaped).

## Notification administration — 2026-11-03

- `GET/PATCH /api/admin/notifications` requires JWT authentication and the existing administrator role guard. Clients, organizers and scanner users cannot read or change global delivery preferences.
- The API validates notification identifiers and real boolean values, rejects extra fields and duplicate keys, and uses a database transaction with a row lock plus an expected version to reject stale edits. The modifying administrator ID and update time are stored without returning credentials or recipient lists.
- Delivery checks run on the backend for transactional mail, marketing, SMS, WhatsApp and push. New sign-in alerts are disabled initially and do not run during session refresh or support-session creation; delivery failure never invalidates a login.
- Deployment requires explicitly applying `backend/src/database/add-notification-settings.sql`; automatic schema synchronization stays disabled. Only a missing settings table during rollout preserves historical delivery defaults; other database errors do not bypass stored preferences. The administrative page remains unavailable until the table is prepared.
- Disabling ticket delivery or password recovery is an explicit administrative choice, identified in the UI before saving. Messages already sent or accepted by external providers cannot be recalled by these controls.
