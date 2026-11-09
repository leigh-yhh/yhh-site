# Activepieces → Zoho CRM field mapping

Use this when configuring the Activepieces flows behind `AP_WEBHOOK_WISHLIST` and `AP_WEBHOOK_INTROCALL`.

**Status (2026-10-27):** Production secrets for wishlist + introCall are set, but the webhook URLs currently resolve to **HTTP 404**. Publish new AP flows, then `wrangler secret put` the new URLs. See [SMOKE-TEST-RESULTS.md](./SMOKE-TEST-RESULTS.md).

## Envelope (Worker → Activepieces)

Every submit arrives as a **flat JSON body**: form fields at the root, plus meta keys.

```json
{
  "firstName": "…",
  "lastName": "…",
  "email": "…",
  "form": "wishlistLight",
  "flow": "wishlist | introCall | …",
  "source": "yourhomehunter.com.au",
  "pageUrl": "https://…",
  "submittedAt": "2026-10-27T11:00:00.000Z"
}
```

In Activepieces, map from `trigger.body.firstName` (etc.). Do **not** expect a nested `data` object.

## Flow: `wishlist` (Request a Search / WishListLight)

Native form body matches the existing Zoho Forms JSON (flat on `trigger.body`).

### Destination

**Module: Leads** (upsert on Email) — or keep your existing Forms → CRM mapping.

| Body field (Zoho Forms parity) | Zoho Leads API name | Notes |
|---|---|---|
| `firstName` | `First_Name` | |
| `lastName` | `Last_Name` | |
| `email` | `Email` | Upsert key |
| `phone` | `Phone` | |
| `location` | `City` | Melbourne / Brisbane / Canberra / Adelaide |
| `currentLocation` | `Search_Location` | Relocating from |
| `rentalBudget` | `Budget_weekly` / `Weekly_Budget` | |
| `moveByDate` | `Lease_Start_Date` | Format `29-Oct-2026` |
| `formSource` | `Lead_Source` | Picklist display values |
| `referral` | `Referred_by` | |
| `propertyType` | Description / custom | Array |
| `suburbs` | Description / custom | Array only (ignore suburbsMelbourne etc. for now) |
| `propertyRequirements` | Description / custom | Array |
| `otherDetails` | `Description` | Notes |
| `bedrooms` / `bathrooms` | Description / custom | |
| `referer` | optional | Browser referrer URL |
| `userCountry` | optional | Set by Worker from Cloudflare IP geo (e.g. `Australia`) |

Worker also appends: `flow`, `source` (`yourhomehunter.com.au`), `pageUrl`, `submittedAt`.

### Sample body (wishlist)

```json
{
  "firstName": "Bianca",
  "lastName": "Evans",
  "email": "bianca.evans79@yahoo.com.au",
  "phone": "0435677850",
  "currentLocation": "Canberra",
  "location": "Canberra",
  "propertyType": ["All types"],
  "bedrooms": "1",
  "bathrooms": "2",
  "suburbs": ["Chifley", "Curtin"],
  "rentalBudget": "370",
  "moveByDate": "29-Oct-2026",
  "propertyRequirements": ["Pets"],
  "otherDetails": "…",
  "formSource": "Google Search",
  "referral": "",
  "referer": "https://www.yourhomehunter.com.au/",
  "userCountry": "Australia"
}
```

### Activepieces recipe (wishlist)

1. **Webhook** trigger (`AP_WEBHOOK_WISHLIST` + `Authentication` header).
2. Map `trigger.body.*` the same way as the Zoho Form payload.
3. **Zoho CRM** upsert Lead (or existing Forms destination).
4. Optional team notify.

---

## Flow: `introCall` (enquiry / discovery)

### Destination

**Module: Leads** (upsert on Email).

| Site `data.*` | Zoho Leads API name | Notes |
|---|---|---|
| `firstName` | `First_Name` | |
| `lastName` | `Last_Name` | |
| `email` | `Email` | Upsert key |
| `phone` | `Phone` | |
| `city` | `City` | |
| `service` | include in `Description` | Service interest |
| `notes` | `Description` | Prefix with `[Website introCall]` |
| — | `Lead_Source` | `Website` is not in picklist — use Advertisement or leave empty and note in Description |

### Sample `data` (introCall)

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@email.com",
  "phone": "0412 345 678",
  "city": "Melbourne",
  "service": "Full Service Package",
  "notes": "Relocating in January",
  "privacyConsent": true,
  "privacyConsentAt": "2026-10-27T11:00:00.000Z"
}
```

### Activepieces recipe (introCall)

Same as wishlist, behind `AP_WEBHOOK_INTROCALL`, without suburb/budget fields.

---

## Other flows (enable when retiring each Zoho Form)

| `flow` | Worker secret | Suggested CRM target |
|---|---|---|
| `consult` | `AP_WEBHOOK_CONSULT` | Lead + Task / Meeting note |
| `inspectionBooking` | `AP_WEBHOOK_INSPECTIONBOOKING` | Lead/Contact + Task |
| `tenancyApplication` | `AP_WEBHOOK_TENANCYAPPLICATION` | Contacts + Applications module; files via Drive |
| `serviceAgreement` | `AP_WEBHOOK_SERVICEAGREEMENT` | Prefer DocuSign; if used, Contacts checklist fields |
| `inspector` | `AP_WEBHOOK_INSPECTOR` | Vendors or custom |

Empty secrets cause the Worker to respond `{ ok: true, skipped: true }` — the site now treats that as a **failed** submit.

---

## Smoke test (curl)

```bash
curl -sS -X POST "https://yhh-submit-proxy.leigh-8cd.workers.dev/api/submit" \
  -H "Content-Type: application/json" \
  -H "Origin: https://yhh.leigh-8cd.workers.dev" \
  -d "{\"flow\":\"wishlist\",\"pageUrl\":\"https://yhh.leigh-8cd.workers.dev/request-full-service\",\"data\":{\"form\":\"wishlistLight\",\"firstName\":\"AP\",\"lastName\":\"SmokeTest\",\"email\":\"ap.smoketest+yhh@example.com\",\"phone\":\"0400000000\",\"city\":\"Melbourne\",\"relocationFrom\":\"Test\",\"propertyTypes\":[\"House\"],\"bedrooms\":\"2\",\"bathrooms\":\"1\",\"suburbs\":[],\"suburb1\":\"\",\"suburb2\":\"\",\"suburb3\":\"\",\"suburb4\":\"\",\"budgetWeekly\":\"700\",\"moveDate\":\"\",\"propertyRequirements\":[],\"notes\":\"AP smoke test — safe to delete\",\"source\":\"Google Search\",\"referrer\":\"\",\"privacyConsent\":true}}"
```

Expect `{ "ok": true }` (not `skipped`). Then confirm a Lead in Zoho CRM for that email.
