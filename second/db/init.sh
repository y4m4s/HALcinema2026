#!/usr/bin/env bash
# Initializes (or resets) the local SQLite database from schema.sql + seed.sql.
# Usage (from anywhere):  ./second/db/init.sh
# Requires Go to be installed; no external sqlite3 CLI is needed.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backend_dir="${script_dir}/../backend"

cd "${backend_dir}"
go run ./cmd/dbinit
