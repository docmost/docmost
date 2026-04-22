[CmdletBinding()]
param(
    [string]$LocalImage = "docmost/gitea-oauth:v1.0.0",
    [string]$RegistryTag = "",
    [string]$ComposeFile = "docker-compose.deploy.yml",
    [string]$ServiceName = "docmost",
    [string]$HealthUrl = "http://127.0.0.1:3008/api/health",
    [int]$HealthRetries = 20,
    [int]$HealthDelaySeconds = 2
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Checked([string]$Command) {
    Write-Host $Command -ForegroundColor DarkGray
    Invoke-Expression $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $Command"
    }
}

Write-Step "Building local image $LocalImage"
Invoke-Checked "docker build -t $LocalImage ."

if ($RegistryTag) {
    Write-Step "Tagging registry image $RegistryTag"
    Invoke-Checked "docker tag $LocalImage $RegistryTag"
}

$existingContainer = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $ServiceName }
if ($existingContainer) {
    Write-Step "Removing existing container $ServiceName"
    Invoke-Checked "docker rm -f $ServiceName"
}

Write-Step "Starting $ServiceName with $ComposeFile"
Invoke-Checked "docker compose -f $ComposeFile up -d $ServiceName"

Write-Step "Waiting for container startup"
Start-Sleep -Seconds 4

Write-Step "Container status"
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | Select-String $ServiceName

Write-Step "Recent logs"
docker logs --tail 80 $ServiceName

Write-Step "Waiting for health endpoint"
$healthOk = $false
for ($attempt = 1; $attempt -le $HealthRetries; $attempt++) {
    try {
        $response = curl.exe -sS -i $HealthUrl
        if ($LASTEXITCODE -eq 0 -and $response -match "200 OK") {
            $healthOk = $true
            Write-Host $response
            break
        }
    } catch {
    }

    Write-Host "Health check attempt $attempt/$HealthRetries not ready yet..." -ForegroundColor Yellow
    Start-Sleep -Seconds $HealthDelaySeconds
}

if (-not $healthOk) {
    throw "Health check did not succeed for $HealthUrl"
}

Write-Host ""
Write-Host "Local rebuild completed." -ForegroundColor Green
