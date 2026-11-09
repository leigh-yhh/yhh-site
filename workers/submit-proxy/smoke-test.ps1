# Smoke-test yhh-submit-proxy → Activepieces
# Usage: pwsh ./smoke-test.ps1

$ErrorActionPreference = 'Continue'
$origin = 'https://yhh.leigh-8cd.workers.dev'
$proxy = 'https://yhh-submit-proxy.leigh-8cd.workers.dev/api/submit'
$email = "ap.smoketest+yhh$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"

function Post-Flow($flow, $data) {
  $body = @{ flow = $flow; pageUrl = "$origin/request-full-service"; data = $data } | ConvertTo-Json -Depth 8 -Compress
  Write-Host "`n=== $flow ==="
  try {
    $r = Invoke-WebRequest -Uri $proxy -Method POST -ContentType 'application/json' `
      -Headers @{ Origin = $origin; Accept = 'application/json' } -Body $body -UseBasicParsing
    Write-Host "STATUS=$($r.StatusCode) BODY=$($r.Content)"
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $reader = [System.IO.StreamReader]::new($resp.GetResponseStream())
      Write-Host "STATUS=$([int]$resp.StatusCode) BODY=$($reader.ReadToEnd())"
    } else {
      Write-Host $_.Exception.Message
    }
  }
}

Write-Host "Smoke email: $email"

Post-Flow 'wishlist' @{
  form = 'wishlistLight'
  firstName = 'AP'
  lastName = 'SmokeTest'
  relocationFrom = 'E2E'
  email = $email
  phone = '0400000000'
  propertyTypes = @('House')
  bedrooms = '2'
  bathrooms = '1'
  city = 'Melbourne'
  suburbs = @()
  suburb1 = ''; suburb2 = ''; suburb3 = ''; suburb4 = ''
  budgetWeekly = '700'
  moveDate = ''
  propertyRequirements = @()
  notes = 'AP smoke test — safe to delete'
  source = 'Google Search'
  referrer = ''
  privacyConsent = $true
}

Post-Flow 'introCall' @{
  firstName = 'AP'
  lastName = 'IntroSmoke'
  email = $email
  phone = '0400000000'
  city = 'Melbourne'
  service = 'Full Service Package'
  notes = 'AP introCall smoke test — safe to delete'
  privacyConsent = $true
}

Post-Flow 'consult' @{ firstName = 'X' }

Write-Host "`nDone. Expect wishlist/introCall 200 {ok:true}. Expect consult 503 skipped until configured."
Write-Host "Then search Zoho Leads for: $email"
