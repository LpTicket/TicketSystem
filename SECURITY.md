# Security Notes

This document tracks security hardening done on LPTicket and known follow-ups.

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
- **Public ticket lookup sanitized** — gate verification returns only the
  fields needed, never password hash / address / full order or user record.
- **XSS in JSON-LD** — `<` is escaped so a crafted event title can't break out.
- **429 UX** — web and mobile show a friendly "try again in N seconds" message.

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
