# Custom Directives & Architectural Guidelines

This document establishes operational directives for AI agents, developers, and code generators maintaining the **AI Journal & Reflections** platform.

---

## 1. Google Maps Directive: Secure Maps API & Secret Management

When implementing or extending location-aware features (such as pinning geographic metadata, reverse geocoding, and map rendering):

1. **Server-Side Proxy Architecture**:
   - **Zero Client-Side Keys**: The `GOOGLE_MAPS_API_KEY` must never be exposed to the client browser or bundled in frontend client builds. All geocoding, reverse geocoding, and place lookups must route through server-side endpoints (e.g., `/api/geocode`).
   - If interactive client maps are rendered in the browser, ephemeral session tokens or maps restricted strictly to the verified origin domain (`HTTP referrers`) must be used.

2. **Strict Coordinate Boundary Validation**:
   - Every coordinate payload received on input surfaces or written to storage must be strictly validated:
     - `latitude`: Floating-point number between `-90.0` and `+90.0` (inclusive).
     - `longitude`: Floating-point number between `-180.0` and `+180.0` (inclusive).
   - Reject or clamp any out-of-bounds, `NaN`, or string-injected coordinates immediately at the API boundary.

3. **Input Sanitization for Place Queries**:
   - Free-text address and place search strings must be truncated (e.g., maximum 200 characters) and sanitized to strip control characters and prevent injection attacks.

4. **Secret Manager & Environment Injection**:
   - Operational credentials must be retrieved dynamically via environment variables (`process.env.GOOGLE_MAPS_API_KEY`) or Google Cloud Secret Manager.
   - If the API key is not yet configured, the system must degrade gracefully (e.g., providing fallback coordinate resolution or clear UI notices) without crashing the application server.

5. **Firestore Security Rules Enforcement**:
   - Firestore security rules must implement an `isValidLocation(location)` check ensuring that persisted locations conform to schema types and valid coordinate bounds.

---

## 2. Admin Roles Directive: Role-Based Access Control (RBAC) & Security Checks

When designing or implementing administrative capabilities, telemetry dashboards, or privileged operations:

1. **Zero-Trust Administrative Authorization**:
   - Never trust client-supplied boolean flags (e.g., `{ isAdmin: true }` in request bodies).
   - Administrative privilege must be verified server-side through:
     - Verified Firebase Authentication JWT Custom Claims (`decodedToken.admin === true`), OR
     - Cryptographically validated server session matching an explicit server-side `ADMIN_EMAILS` whitelist, OR
     - A protected Firestore role record verified by backend admin service.

2. **Strict Privacy Boundary (Tenant Isolation vs. Admin Metrics)**:
   - **No Cross-User Content Leakage**: Admins must **NEVER** have blanket access to view raw personal journal entries, private reflections, or unencrypted thoughts of other users.
   - Admin dashboards are strictly limited to **System Aggregations & Telemetry**:
     - System-wide counts (e.g., total entries, active user count).
     - Mood and sentiment aggregate distributions.
     - Gemini AI model fallback telemetry and latency metrics.
     - Security audit logs (anonymized user IDs, event timestamps, action types).

3. **Firestore Security Rules RBAC Enforcement**:
   - Database rules must enforce access control at the rule engine level:
     ```javascript
     function isAdmin() {
       return request.auth != null && 
         (request.auth.token.admin == true || 
          request.auth.token.email in ['chavansantu1899@gmail.com']);
     }
     ```
   - Privileged administrative collections (such as `/admin/metrics` or `/system_metrics`) must be constrained by `isAdmin()` checks, while `/users/{userId}/entries` remains strictly locked to `request.auth.uid == userId`.

4. **Audit Trail Logging**:
   - Every administrative action (metric generation, role assignment, system configuration check) must generate an audit log record containing timestamp, actor UID/email, action type, and status.

---

## 3. Notification API Directive: External Webhook Security & Payload Schemas

When integrating external notification services (Slack, Discord, Email, or custom HTTPS webhooks):

1. **Server-Side SSRF (Server-Side Request Forgery) Defense**:
   - Any external notification dispatch must be executed server-side with strict URL validation:
     - **Protocol Restriction**: Must enforce `https://` only.
     - **IP Blocklisting**: Resolve destination domain and reject RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`), and Cloud Instance Metadata services (`metadata.google.internal` or `169.254.169.254`).
   - Never allow dynamic user input to target internal network addresses or metadata APIs.

2. **Credential & Webhook URL Management**:
   - Webhook URLs and API tokens must be managed securely through `process.env.NOTIFICATION_WEBHOOK_URL` or Secret Manager.
   - Webhook secrets must never be exposed to frontend code or logged in error messages.

3. **Privacy-Preserving Minimal Payload Schema**:
   - Outbound notifications must strip all Personally Identifiable Information (PII) and private journal bodies.
   - Allowed notification schema:
     ```json
     {
       "event": "journal_milestone_alert",
       "timestamp": "2026-09-06T08:00:00.000Z",
       "userHash": "usr_9a8b7c6d",
       "mood": "Challenged",
       "theme": "Resilience & Growth",
       "tags": ["Milestone", "Urgent Reflection"],
       "summarySnippet": "User completed a key personal reflection on team leadership.",
       "locationSummary": "San Francisco, CA"
     }
     ```

4. **Resilience & Rate Limiting**:
   - All outbound webhook requests must enforce a strict timeout (e.g., 5000ms) to prevent thread exhaustion.
   - Implement rate limits and error trapping so that third-party webhook failures never block or delay the primary journal persistence flow.
