# SkipSense Server Startup Script

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "          SKIPSENSE SERVER          " -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Cyan

# 1. Check Python
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    # Check default install path
    if (Test-Path "C:\Users\azfrh\AppData\Local\Programs\Python\Python313\python.exe") {
        $env:Path = "C:\Users\azfrh\AppData\Local\Programs\Python\Python313;C:\Users\azfrh\AppData\Local\Programs\Python\Python313\Scripts;" + $env:Path
    } else {
        Write-Host "ERROR: Python is not installed or not in PATH." -ForegroundColor Red
        Pause
        Exit 1
    }
}

# 2. Check Node & npm
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "ERROR: Node.js is not installed or not in PATH." -ForegroundColor Red
    Pause
    Exit 1
}

# 3. Virtual environment
$root = Resolve-Path "$PSScriptRoot\.."
Set-Location $root

if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment (.venv)..." -ForegroundColor Yellow
    python -m venv .venv
}

$venvPython = "$root\.venv\Scripts\python.exe"
$venvPip = "$root\.venv\Scripts\pip.exe"

# 4. Check dependencies
if (-not (Test-Path ".venv\Lib\site-packages\fastapi")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    & $venvPip install -r "$root\backend\requirements.txt"
}

if (-not (Test-Path "$root\frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location "$root\frontend"
    npm.cmd install
    Set-Location $root
}

# 5. Detect local LAN IPv4 Address
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL" -and 
    $_.IPAddress -notmatch "^169\.254\." -and
    $_.IPAddress -notmatch "^192\.168\.137\."
} | Select-Object -First 1).IPAddress

if (-not $lanIp) {
    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL" -and 
        $_.IPAddress -notmatch "^169\.254\." 
    } | Select-Object -First 1).IPAddress
}

if (-not $lanIp) {
    $lanIp = "127.0.0.1"
}

# 6. Ensure mkcert certificates exist for LAN IP
$certPath = "$root\certificates\cert.pem"
$keyPath = "$root\certificates\key.pem"
if (-not (Test-Path $certPath) -or -not (Test-Path $keyPath)) {
    Write-Host "Generating local HTTPS certificates via mkcert..." -ForegroundColor Yellow
    mkcert -cert-file "$certPath" -key-file "$keyPath" localhost 127.0.0.1 "$lanIp" ::1
    Copy-Item "$env:LOCALAPPDATA\mkcert\rootCA.pem" "$root\certificates\rootCA.pem" -ErrorAction SilentlyContinue
    Copy-Item "$env:LOCALAPPDATA\mkcert\rootCA.pem" "$root\frontend\public\rootCA.pem" -ErrorAction SilentlyContinue
}

# 7. Start Backend (FastAPI via Uvicorn)
Write-Host "Starting FastAPI Backend on port 8000..." -ForegroundColor Cyan
$backendProc = Start-Process -FilePath $venvPython -ArgumentList "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000" -PassThru -NoNewWindow

# 8. Start Frontend (Vite with HTTPS)
Write-Host "Starting Vite Frontend on port 5173..." -ForegroundColor Cyan
Set-Location "$root\frontend"
$frontendProc = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -PassThru -NoNewWindow
Set-Location $root

Start-Sleep -Seconds 3

# 9. Display Server Info Banner
Clear-Host
Write-Host "====================================" -ForegroundColor Green
Write-Host "          SKIPSENSE SERVER          " -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend API:" -ForegroundColor Gray
Write-Host "  http://127.0.0.1:8000" -ForegroundColor White
Write-Host ""
Write-Host "Frontend (Laptop):" -ForegroundColor Gray
Write-Host "  https://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "iPhone Access (Same Wi-Fi):" -ForegroundColor Gray
Write-Host "  https://$($lanIp):5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "Status: RUNNING" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host "Press Ctrl+C or run stop.bat to shut down servers." -ForegroundColor Gray

# Write process IDs to .pids for stop.bat
"$($backendProc.Id),$($frontendProc.Id)" | Out-File "$root\.server_pids" -Force

# Keep script active
try {
    Wait-Process -Id $backendProc.Id, $frontendProc.Id
} catch {
    # Exit cleanly
}

