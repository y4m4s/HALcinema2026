# Initializes (or resets) the local SQLite database from schema.sql + seed.sql.
# Usage (from anywhere):  ./second/db/init.ps1
# Requires Go to be installed; no external sqlite3 CLI is needed.

$ErrorActionPreference = 'Stop'

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir '..\backend'

Push-Location $backendDir
try {
    go run ./cmd/dbinit
}
finally {
    Pop-Location
}
