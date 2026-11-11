# YHH submit proxy (Cloudflare Worker)

Hides Activepieces webhook URLs from the browser. The site POSTs `{ flow, data, pageUrl }` to this Worker; the Worker forwards to Activepieces using secrets.

Tenancy applications are split: `tenancyApplication` (form JSON) then `tenancyApplicationFiles` (one base64 file per request) so payloads stay manageable.

Zoho CRM field mapping for Activepieces: see [ACTIVEPIECES-ZOHO-MAPPING.md](./ACTIVEPIECES-ZOHO-MAPPING.md).

## Setup

```bash
cd workers/submit-proxy
npm i -g wrangler   # if needed
cp .dev.vars.example .dev.vars
# paste Activepieces webhook URLs into .dev.vars
npx wrangler secret put AP_WEBHOOK_WISHLIST
npx wrangler secret put AP_WEBHOOK_WISHLIST_AUTH   # full Authorization value, e.g. Bearer …
# …repeat for each flow used
npx wrangler deploy
```

Then set `submitApiUrl` in site `contact-config.js` to the Worker URL (or `https://www.yourhomehunter.com.au/api/submit` once a custom route is attached).

If a flow’s webhook secret is empty, the Worker returns **503** `{ ok: false, skipped: true }` and the site shows an error (it will not pretend the submit succeeded).

Activepieces header auth: when `AP_WEBHOOK_*_AUTH` is set, the Worker forwards that value as-is. Wishlist uses `Authorization`; other flows default to `Authentication`.

## Local

```bash
npx wrangler dev
# point submitApiUrl at http://127.0.0.1:8787/api/submit
```
