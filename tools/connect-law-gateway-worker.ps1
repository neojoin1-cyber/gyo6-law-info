param(
  [string]$GatewayUrl = "",
  [string]$GatewayToken = ""
)

$ErrorActionPreference = "Stop"

function Read-SecretInput {
  param([string]$Prompt)
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name 명령을 찾을 수 없습니다."
  }
}

Assert-Command "npx.cmd"

if ([string]::IsNullOrWhiteSpace($GatewayUrl)) {
  $GatewayUrl = Read-Host "Cloud Run Gateway URL"
}

$GatewayUrl = $GatewayUrl.Trim().TrimEnd("/")
if ($GatewayUrl -notmatch "^https://") {
  throw "GatewayUrl은 https:// 로 시작해야 합니다."
}

if ([string]::IsNullOrWhiteSpace($GatewayToken)) {
  $GatewayToken = Read-SecretInput "Cloud Run 배포 때 입력한 GYO6_MCP_TOKEN"
}

if ([string]::IsNullOrWhiteSpace($GatewayToken)) {
  throw "GatewayToken은 비워둘 수 없습니다."
}

$workerConfig = "workers/ai-analysis/wrangler.toml"

Write-Host "Checking gateway health..."
$health = Invoke-WebRequest -Uri "$GatewayUrl/health" -UseBasicParsing
Write-Host $health.Content

Write-Host "Checking gateway original text endpoint..."
$body = @{
  queries = @("직업교육훈련 촉진법")
  keywords = @("현장실습", "청소")
  maxArticles = 4
} | ConvertTo-Json -Compress

$sourceCheck = Invoke-WebRequest `
  -Uri "$GatewayUrl/gyo6/law/search-and-read" `
  -Method POST `
  -Headers @{ "content-type" = "application/json"; "x-gyo6-mcp-token" = $GatewayToken } `
  -Body $body `
  -UseBasicParsing

Write-Host $sourceCheck.Content

Write-Host "Setting Worker secret: KOREAN_LAW_MCP_BASE_URL"
$GatewayUrl | npx.cmd wrangler secret put KOREAN_LAW_MCP_BASE_URL --config $workerConfig

Write-Host "Setting Worker secret: KOREAN_LAW_MCP_TOKEN"
$GatewayToken | npx.cmd wrangler secret put KOREAN_LAW_MCP_TOKEN --config $workerConfig

Write-Host "Deploying Worker..."
npm run worker:deploy

Write-Host "Checking Worker health..."
$workerHealth = Invoke-WebRequest -Uri "https://gyo6-law-info-ai.gyo6.workers.dev/api/health" -UseBasicParsing
Write-Host $workerHealth.Content

Write-Host "Checking Worker official source search..."
$query = [Uri]::EscapeDataString("현장실습 시간 종료 후 청소")
$laws = [Uri]::EscapeDataString("직업교육훈련 촉진법")
$keywords = [Uri]::EscapeDataString("현장실습|청소")
$workerSearch = Invoke-WebRequest -Uri "https://gyo6-law-info-ai.gyo6.workers.dev/api/search?q=$query&laws=$laws&keywords=$keywords" -UseBasicParsing
Write-Host $workerSearch.Content

Write-Host "Done. gyo6.kr should now receive official law source context through the gateway."
