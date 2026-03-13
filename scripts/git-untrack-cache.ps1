# Убрать node_modules и .next из индекса Git (файлы на диске остаются).
# Запуск: .\scripts\git-untrack-cache.ps1

$ErrorActionPreference = "SilentlyContinue"
git rm -r --cached node_modules
git rm -r --cached .next
$ErrorActionPreference = "Continue"
Write-Host "Done. Run: git add . ; git status"
