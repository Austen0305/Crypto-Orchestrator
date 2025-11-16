# Bundle Python runtime for Electron distribution
# This script packages Python and dependencies for inclusion in Electron app

param(
    [string]$PythonVersion = "3.11",
    [string]$OutputDir = "python-runtime",
    [switch]$IncludeAllPackages = $false
)

Write-Host "=== Bundling Python Runtime for Electron ===" -ForegroundColor Cyan

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Found Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python not found. Please install Python first." -ForegroundColor Red
    exit 1
}

# Create output directory
if (Test-Path $OutputDir) {
    Write-Host "Cleaning existing output directory..." -ForegroundColor Yellow
    Remove-Item $OutputDir -Recurse -Force
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
Write-Host "Created output directory: $OutputDir" -ForegroundColor Green

# Create virtual environment in output directory
Write-Host "Creating virtual environment..." -ForegroundColor Cyan
python -m venv "$OutputDir\venv"

# Activate virtual environment
$venvPython = "$OutputDir\venv\Scripts\python.exe"
$venvPip = "$OutputDir\venv\Scripts\pip.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "ERROR: Failed to create virtual environment" -ForegroundColor Red
    exit 1
}

Write-Host "Installing dependencies..." -ForegroundColor Cyan
& $venvPip install --upgrade pip setuptools wheel
& $venvPip install -r requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Copy server_fastapi to output
Write-Host "Copying server_fastapi..." -ForegroundColor Cyan
Copy-Item -Path "server_fastapi" -Destination "$OutputDir\server_fastapi" -Recurse -Force

# Copy shared directory
Write-Host "Copying shared directory..." -ForegroundColor Cyan
Copy-Item -Path "shared" -Destination "$OutputDir\shared" -Recurse -Force

# Copy requirements.txt
Copy-Item -Path "requirements.txt" -Destination "$OutputDir\requirements.txt" -Force

# Create startup script
$startScript = @"
@echo off
setlocal enabledelayedexpansion

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
set VENV_PYTHON=%SCRIPT_DIR%venv\Scripts\python.exe
set MAIN_FILE=%SCRIPT_DIR%server_fastapi\main.py

REM Check if Python exists
if not exist "%VENV_PYTHON%" (
    echo ERROR: Python runtime not found at %VENV_PYTHON%
    pause
    exit /b 1
)

REM Set environment variables
set PYTHONUNBUFFERED=1
set FASTAPI_ENV=production

REM Start FastAPI server
echo Starting CryptoOrchestrator API server...
"%VENV_PYTHON%" "%MAIN_FILE%"

if errorlevel 1 (
    echo ERROR: Failed to start server
    pause
    exit /b 1
)
"@

$startScript | Out-File -FilePath "$OutputDir\start_server.bat" -Encoding ASCII
Write-Host "Created startup script: start_server.bat" -ForegroundColor Green

# Create Linux startup script
$startScriptLinux = @"
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_PYTHON="$SCRIPT_DIR/venv/bin/python"
MAIN_FILE="$SCRIPT_DIR/server_fastapi/main.py"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "ERROR: Python runtime not found at $VENV_PYTHON"
    exit 1
fi

export PYTHONUNBUFFERED=1
export FASTAPI_ENV=production

echo "Starting CryptoOrchestrator API server..."
"$VENV_PYTHON" "$MAIN_FILE"
"@

$startScriptLinux | Out-File -FilePath "$OutputDir\start_server.sh" -Encoding UTF8
Write-Host "Created startup script: start_server.sh" -ForegroundColor Green

# Create macOS startup script
$startScriptMac = @"
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_PYTHON="$SCRIPT_DIR/venv/bin/python"
MAIN_FILE="$SCRIPT_DIR/server_fastapi/main.py"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "ERROR: Python runtime not found at $VENV_PYTHON"
    exit 1
fi

export PYTHONUNBUFFERED=1
export FASTAPI_ENV=production

echo "Starting CryptoOrchestrator API server..."
"$VENV_PYTHON" "$MAIN_FILE"
"@

$startScriptMac | Out-File -FilePath "$OutputDir\start_server.sh" -Encoding UTF8

Write-Host "=== Python Runtime Bundled Successfully ===" -ForegroundColor Green
Write-Host "Output directory: $OutputDir" -ForegroundColor Cyan
Write-Host "Size: $((Get-ChildItem $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB) MB" -ForegroundColor Cyan

