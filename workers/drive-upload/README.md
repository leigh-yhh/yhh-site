# YHH Drive upload (Cloudflare Worker)

Accepts tenancy supporting documents from the browser and writes them into Google Drive under a locked parent folder. Service-account credentials never reach the client.

Flow: **site → this Worker → Google Drive** (per-applicant subfolder). The tenancy form then POSTs only Drive metadata (`folderId`, `folderUrl`, file ids) through `yhh-submit-proxy` → Activepieces → Zoho.

## Google Cloud setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or reuse) a project.
2. Enable **Google Drive API**.
3. Create a **service account** (no key in source control).
4. Create a JSON key for that service account.
5. In Google Drive (Workspace recommended):
   - Create a parent folder, e.g. `YHH Tenancy Applications`, **or** use a Shared Drive.
   - Share that folder / Shared Drive with the service account email as **Editor** (folder) or **Content manager** (Shared Drive).
6. Copy the folder ID from the URL (`…/folders/FOLDER_ID`).

Optional (Workspace admin): enable **domain-wide delegation** for the service account with scope `https://www.googleapis.com/auth/drive`, then set `GDRIVE_IMPERSONATE_USER` to a real mailbox (e.g. `ops@yourhomehunter.com.au`) so files land in that user’s Drive tree.

## Deploy

```bash
cd workers/drive-upload
# paste the full service-account JSON when prompted
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON

# set parent folder (vars also work in wrangler.toml)
npx wrangler secret put GDRIVE_PARENT_FOLDER_ID
# or edit wrangler.toml [vars] GDRIVE_PARENT_FOLDER_ID = "..."

npx wrangler deploy
```

Then set `driveUploadApiUrl` in site `contact-config.js` to:

- `https://yhh-drive-upload.<your-subdomain>.workers.dev/api/drive/upload`, or
- `https://www.yourhomehunter.com.au/api/drive/upload` after attaching a custom route.

## Local

```bash
cp .dev.vars.example .dev.vars
# fill GOOGLE_SERVICE_ACCOUNT_JSON and GDRIVE_PARENT_FOLDER_ID
npx wrangler dev
# point driveUploadApiUrl at http://127.0.0.1:8787/api/drive/upload
```

## Browser contract

`POST multipart/form-data`

| Field | Meaning |
|---|---|
| `folderLabel` | e.g. `Smith_Jane_2026-11-10` |
| `email` | optional, audit only |
| `pageUrl` | optional |
| *(file fields)* | field **name** = doc key (`licence`, `passport`, `medicare`, `payslips`, `ownership`, `pet`, `otherIncome`, …) |

Limits: PDF/JPEG/PNG/WebP/HEIC/GIF, **8 MB** per file, **20** files, **~64 MB** total.

Success:

```json
{
  "ok": true,
  "folderId": "…",
  "folderName": "Smith_Jane_2026-11-10",
  "folderUrl": "https://drive.google.com/drive/folders/…",
  "files": [
    { "id": "…", "name": "licence__dl-front.pdf", "docKey": "licence", "mimeType": "application/pdf", "size": 12345, "webViewLink": "…" }
  ]
}
```

## Security notes

- CORS locked to `ALLOWED_ORIGINS`.
- No public Drive upload link; only the Worker’s service account can write.
- Do not commit `.dev.vars` or JSON keys.
- Rotate the service-account key if it is ever exposed.
