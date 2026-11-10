# Activepieces → Zoho CRM field mapping

Use this when configuring the Activepieces flows behind the submit-proxy webhooks.

**Sample webhook bodies (all flows):** [ACTIVEPIECES-SAMPLE-PAYLOADS.json](./ACTIVEPIECES-SAMPLE-PAYLOADS.json) — paste into Catch Webhook → sample / test data. Fields are at `trigger.body.*` (flat).

**Status:** Publish Activepieces webhook flows, then `wrangler secret put` the URLs (and optional `*_AUTH` tokens).

## Envelope (Worker → Activepieces)

Every submit arrives as a **flat JSON body**: form fields at the root, plus meta keys.

```json
{
  "firstName": "…",
  "lastName": "…",
  "email": "…",
  "source": "yourhomehunter.com.au",
  "pageUrl": "https://…",
  "submittedAt": "2026-10-27T11:00:00.000Z",
  "userCountry": "Australia"
}
```

In Activepieces, map from `trigger.body.firstName` (etc.). Do **not** expect a nested `data` object. Do **not** expect a `flow` field — routing is Worker-side only (separate webhook URL per flow).

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

Worker also appends: `source` (`yourhomehunter.com.au`), `pageUrl`, `submittedAt`, `userCountry`.

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
| `tenancyApplication` | `AP_WEBHOOK_TENANCYAPPLICATION` | Contacts + Applications (form fields only) |
| `tenancyApplicationFiles` | `AP_WEBHOOK_TENANCYAPPLICATIONFILES` | Google Drive upload (one file per webhook) |
| `serviceAgreement` | `AP_WEBHOOK_SERVICEAGREEMENT` | Prefer DocuSign; if used, Contacts checklist fields |
| `inspector` | `AP_WEBHOOK_INSPECTOR` | Vendors or custom |

### tenancyApplication (nested form — no file bytes)

Top-level: `submissionId`, `fileCount`, then groups:

| Group | Key paths |
|---|---|
| `lease` | `portalsUsed`, `commencementDate`, `termMonths` |
| `applicant` | `title`, `firstName`, `middleName`, `lastName`, `preferredName`, `dateOfBirth`, `mobile`, `workPhone`, `email`, `hasCar` |
| `currentAddress` | `country`, `street`, `suburb`, `postcode` |
| `identity` | `licence.{number,cardNumber,state,expiry}`, `passport.{number,country,expiry}`, `otherIdDetails` |
| `household` | `adults`, `children`, `petsCount`, `otherApplicants[]`, `pet.*` |
| `housing` | `livingInOwnHome`, `currentRental` \| `null`, `previousRental`, `ownHome` \| `null` |
| `income` | `isSelfEmployed`, `employment` \| `null`, `previousEmployment`, `selfEmployed` \| `null`, `otherIncome`, `student` \| `null` |
| `references` | `professional`, `personal`, `emergency` |
| `privacy` | `consent`, `consentAt`, `noticeVersion`, `policyVersion` |

Map in AP from e.g. `trigger.body.applicant.email`, `trigger.body.housing.currentRental.agency`. Full sample: [ACTIVEPIECES-SAMPLE-PAYLOADS.json](./ACTIVEPIECES-SAMPLE-PAYLOADS.json).

### tenancyApplicationFiles (one file per request)

| Path | Notes |
|---|---|
| `submissionId` | Same UUID as the application |
| `applicant.{firstName,lastName,email}` | Correlation — build folder name in AP from these |
| `file.index` / `file.count` | e.g. `2` of `5` |
| `file.docKey` | `licence` \| `medicare` \| `payslips` \| `ownership` \| `pet` \| `other` |
| `file.name` / `type` / `size` | Original metadata |
| `file.safeFileName` / `file.driveFileName` | Sanitised (`docKey__safeFileName`) |
| `file.base64` | File contents (PDF/image) |

**Activepieces recipe (files):** Webhook → derive folder name from `applicant` → decode `file.base64` → Google Drive create/reuse folder under parent `14mLBubv5HiboJl7htycLq_RHwISsL5Md` → upload as `file.driveFileName`. Use the Activepieces Google Drive OAuth connection (no service-account JSON key).

Empty secrets cause the Worker to respond `{ ok: false, skipped: true }` — the site treats that as a **failed** submit.

---

## Smoke test (curl)

```bash
curl -sS -X POST "https://yhh-submit-proxy.leigh-8cd.workers.dev/api/submit" \
  -H "Content-Type: application/json" \
  -H "Origin: https://yhh.leigh-8cd.workers.dev" \
  -d "{\"flow\":\"wishlist\",\"pageUrl\":\"https://yhh.leigh-8cd.workers.dev/request-full-service\",\"data\":{\"form\":\"wishlistLight\",\"firstName\":\"AP\",\"lastName\":\"SmokeTest\",\"email\":\"ap.smoketest+yhh@example.com\",\"phone\":\"0400000000\",\"city\":\"Melbourne\",\"relocationFrom\":\"Test\",\"propertyTypes\":[\"House\"],\"bedrooms\":\"2\",\"bathrooms\":\"1\",\"suburbs\":[],\"suburb1\":\"\",\"suburb2\":\"\",\"suburb3\":\"\",\"suburb4\":\"\",\"budgetWeekly\":\"700\",\"moveDate\":\"\",\"propertyRequirements\":[],\"notes\":\"AP smoke test — safe to delete\",\"source\":\"Google Search\",\"referrer\":\"\",\"privacyConsent\":true}}"
```

Expect `{ "ok": true }` (not `skipped`). Then confirm a Lead in Zoho CRM for that email.
