# AI Journal & Reflections (Cloud Run & Firestore)

A secure, user-authenticated reflection and mindful journaling application powered by **Firebase Authentication**, **Cloud Firestore**, and **Gemini 3.6 Flash** deployed on **Google Cloud Run**.

---

## 1. Architecture Overview

- **User Identity**: Firebase Authentication via Federated Google Sign-In.
- **Data Isolation & Storage**: Cloud Firestore where all user documents are strictly confined to `/users/{userId}/...` paths.
- **AI Processing Engine**: Gemini 3.6 Flash API with an automated 4-tier model fallback ladder (`gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`).
- **Location-Aware Entries**: Google Maps integration with server-side Geocoding proxy, GPS pinning, and coordinate validation (-90 to 90 lat, -180 to 180 lng).
- **Admin Dashboard & RBAC**: Role-based access control (`ADMIN_EMAILS`) for system-wide aggregated telemetry with strict tenant privacy guarantees.
- **External Notifications Hub**: Outbound webhooks (Slack, Discord) with server-side SSRF mitigation (RFC 1918, loopback, and Cloud Metadata blocklist).
- **Backend Service**: Express Node.js server proxying Gemini, Geocoding, and Notification requests to keep API keys hidden server-side.
- **Security & Secret Management**: Google Cloud Secret Manager & zero insecure defaults in Firestore rules.

---

## 2. Environment & Prerequisites

1. **Google Cloud SDK**:
   Ensure `gcloud` CLI is installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Enable Required Google Cloud Services**:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     secretmanager.googleapis.com \
     firestore.googleapis.com \
     identitytoolkit.googleapis.com
   ```

---

## 3. Secret & Configuration Management Setup

Store your secrets in Google Cloud Secret Manager and grant access to the Cloud Run default compute service account:

```bash
# 1. Create and populate the Gemini API Key
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Create and populate the Google Maps Platform API Key (Zero Client-Side Keys)
gcloud secrets create GOOGLE_MAPS_API_KEY --replication-policy="automatic"
echo -n "YOUR_GOOGLE_MAPS_API_KEY" | gcloud secrets versions add GOOGLE_MAPS_API_KEY --data-file=-

# 3. Retrieve your Google Cloud Project Number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

# 4. Grant Cloud Run runtime service account permission to read the secrets
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding GOOGLE_MAPS_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Environment Variables (.env)
- `ADMIN_EMAILS`: Comma-separated list of multiple administrator email addresses: `"chavansantu1899@gmail.com,admin@example.com,security@example.com"`
- `NOTIFICATION_WEBHOOK_URL`: Global notification webhook URL (Slack, Discord, or HTTPS endpoint with SSRF protection)
- `GOOGLE_MAPS_API_KEY`: Server-side Maps Platform key (optional, graceful fallback provided)
- `GEMINI_API_KEY`: Gemini API key for reflections, summaries, and chat

---

## 4. Cloud Firestore Security Rules (Multi-Admin RBAC)

Deploy the following `firestore.rules` to enforce absolute user data isolation and multi-admin RBAC:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper: Admin Role Verification via Custom Claims or configured admin emails list
    function isAdmin() {
      return request.auth != null && (
        (request.auth.token.keys().hasAll(['admin']) && request.auth.token.admin == true) ||
        request.auth.token.email in [
          'chavansantu1899@gmail.com',
          'admin@example.com',
          'security@example.com',
          'cloud-architect@example.com',
          'audit-team@example.com'
        ]
      );
    }

    // Disallow global access by default
    match /{document=**} {
      allow read, write: if false;
    }

    // Privileged admin telemetry collections
    match /system_metrics/{metricId} {
      allow read: if isAdmin();
      allow write: if false;
    }

    // User data isolation: strictly bound to authenticated user ID
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

Deploy the rules using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 5. Cloud Run Deployment Flow

Deploy the application to Google Cloud Run, binding secrets and environment configurations:

```bash
# Build and deploy container to Cloud Run
gcloud run deploy ai-journal-reflections \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest,GOOGLE_MAPS_API_KEY=GOOGLE_MAPS_API_KEY:latest" \
  --set-env-vars="NODE_ENV=production,ADMIN_EMAILS=chavansantu1899@gmail.com,admin@example.com,security@example.com,NOTIFICATION_WEBHOOK_URL="
```

---

## 6. Required Campaign Verification Labeling

To register the Cloud Run deployment for automated challenge verification, apply the mandatory resource label:

```bash
gcloud run services update ai-journal-reflections \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 7. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run full-stack dev server (Express + Vite)
npm run dev

# 3. Compile for production
npm run build
```
