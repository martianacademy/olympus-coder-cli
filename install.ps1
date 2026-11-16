# Olympus Coder CLI Installer (Windows PowerShell)
$ErrorActionPreference = "Stop"

$AgentsHome = if ($env:OLYMPUS_HOME) { $env:OLYMPUS_HOME } elseif ($env:OLYMPUS_AGENTS_HOME) { $env:OLYMPUS_AGENTS_HOME } else { Join-Path $HOME ".olympus" }
$BinDir     = Join-Path $AgentsHome "bin"

Write-Host "`n🌋 Installing Olympus Coder CLI...`n" -ForegroundColor Yellow

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm (Node.js >= 22) is required. Install Node.js from https://nodejs.org first."
  exit 1
}

npm install -g github:martianacademy/olympus-coder-cli --no-audit --no-fund

$NpmBin = (npm prefix -g).Trim()
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$CmdShim = Join-Path $BinDir "olympus.cmd"
@"
@echo off
"$NpmBin\olympus.cmd" %*
"@ | Set-Content -Path $CmdShim -Encoding ASCII

$Ver = olympus --version
Write-Host "`n✓ Installed $Ver" -ForegroundColor Green
Write-Host "✓ Run 'olympus login' to connect OpenRouter, Vercel AI Gateway, or Local Ollama.`n" -ForegroundColor Green
