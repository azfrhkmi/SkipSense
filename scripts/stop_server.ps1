# SkipSense Server Stop Script

Write-Host "Stopping SkipSense servers..." -ForegroundColor Yellow

$root = Resolve-Path "$PSScriptRoot\.."

# 1. Kill from stored PIDs if file exists
$pidFile = "$root\.server_pids"
if (Test-Path $pidFile) {
    $pids = (Get-Content $pidFile).Split(',')
    foreach ($p in $pids) {
        if ($p) {
            Stop-Process -Id ([int]$p) -Force -ErrorAction SilentlyContinue
        }
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

# 2. Kill any remaining processes on port 8000 (FastAPI) and 5173 (Vite)
try {
    $ports = @(8000, 5173)
    foreach ($port in $ports) {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($conn in $conns) {
            if ($conn.OwningProcess) {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    }
} catch {}

Write-Host "SkipSense servers stopped successfully." -ForegroundColor Green

