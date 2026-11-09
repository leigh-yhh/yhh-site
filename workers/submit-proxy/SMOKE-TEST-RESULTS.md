# Submit pipeline smoke test results

Date: 2026-10-27

## Secrets on `yhh-submit-proxy` (production)

| Secret | Present |
|---|---|
| `AP_WEBHOOK_WISHLIST` | yes |
| `AP_WEBHOOK_INTROCALL` | yes |
| `AP_WEBHOOK_CONSULT` (and other flows) | no |

## HTTP checks

| Call | Result |
|---|---|
| `POST /api/submit` `flow=wishlist` | **502** `{ ok: false }` — secret set, upstream failed |
| `POST /api/submit` `flow=introCall` | **502** `{ ok: false }` — same |
| `POST /api/submit` `flow=consult` | **503** `{ ok: false, skipped: true }` — expected (secret missing) |
| Direct POST to example wishlist webhook URL | **404** |
| Direct POST to example introCall webhook URL | **404** |

## Conclusion

Site → Worker path is healthy. Production secrets exist for wishlist and introCall, but the Activepieces webhook URLs currently stored (and in `.dev.vars.example`) are **dead (404)**.

**Required before CRM records appear:**

1. In Activepieces, recreate/publish the wishlist and introCall webhook flows using [ACTIVEPIECES-ZOHO-MAPPING.md](./ACTIVEPIECES-ZOHO-MAPPING.md).
2. Copy the new webhook URLs into production:

```bash
cd workers/submit-proxy
npx wrangler secret put AP_WEBHOOK_WISHLIST
npx wrangler secret put AP_WEBHOOK_INTROCALL
```

3. Re-run `./smoke-test.ps1` (or the curl in the mapping doc) and confirm a Lead in Zoho CRM.
