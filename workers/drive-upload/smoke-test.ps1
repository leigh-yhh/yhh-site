# Smoke-test yhh-drive-upload (requires deployed Worker + secrets).
# Usage:
#   .\smoke-test.ps1 -Url "https://yhh-drive-upload.leigh-8cd.workers.dev/api/drive/upload"
#   .\smoke-test.ps1 -Url "http://127.0.0.1:8787/api/drive/upload"

param(
  [Parameter(Mandatory = $true)]
  [string]$Url,
  [string]$Origin = "http://127.0.0.1:5500"
)

$ErrorActionPreference = "Stop"
$tmp = Join-Path $env:TEMP "yhh-drive-smoke.txt"
"YHH Drive upload smoke test $(Get-Date -Format o)" | Set-Content -Path $tmp -Encoding utf8

$form = @{
  folderLabel = "SmokeTest_YHH_$(Get-Date -Format 'yyyy-MM-dd')"
  email       = "ap.smoketest+yhh@example.com"
  pageUrl     = "https://www.yourhomehunter.com.au/tenancy-application"
  licence     = Get-Item -Path $tmp
}

Write-Host "POST $Url"
$res = Invoke-WebRequest -Uri $Url -Method Post -Form $form -Headers @{
  Origin = $Origin
  Accept = "application/json"
}

Write-Host "Status:" $res.StatusCode
Write-Host $res.Content
Remove-Item $tmp -ErrorAction SilentlyContinue
Write-Host "Then confirm a new subfolder under your GDRIVE_PARENT_FOLDER_ID in Google Drive."
