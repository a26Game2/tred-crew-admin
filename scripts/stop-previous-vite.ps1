param(
  [Parameter(Mandatory = $true)][int]$Port,
  [Parameter(Mandatory = $true)][string]$ProjectRoot
)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
$listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
foreach ($listenerId in $listeners) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerId" -ErrorAction SilentlyContinue
  if (-not $process) { continue }
  $command = [string]$process.CommandLine
  $isProjectVite = $process.Name -match '^node(\.exe)?$' -and
    $command.IndexOf($root, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    $command -match '[\\/]vite[\\/]bin[\\/]vite\.js'
  if (-not $isProjectVite) {
    Write-Error "Port $Port is used by another process (PID $listenerId, $($process.Name)). It was not stopped."
    exit 1
  }
}
foreach ($listenerId in $listeners) {
  # Recheck ownership immediately before stopping to avoid killing an unrelated process.
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerId" -ErrorAction SilentlyContinue
  if (-not $process) { continue }
  $command = [string]$process.CommandLine
  if ($process.Name -notmatch '^node(\.exe)?$' -or $command.IndexOf($root, [System.StringComparison]::OrdinalIgnoreCase) -lt 0 -or $command -notmatch '[\\/]vite[\\/]bin[\\/]vite\.js') {
    Write-Error "Port $Port changed ownership; no unrelated process was stopped."
    exit 1
  }
  Write-Host "Stopping previous TRED Crew Admin Vite process on port $Port (PID $listenerId)."
  Stop-Process -Id $listenerId -ErrorAction Stop
  Wait-Process -Id $listenerId -Timeout 10 -ErrorAction SilentlyContinue
}
