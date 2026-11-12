param([int]$Porta = 5000)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$pythonTechstock = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonTechstock)) {
 throw 'Crie o ambiente antes: python -m venv .venv'
}
Write-Host "TechStock: http://127.0.0.1:$Porta — pressione Ctrl+C para encerrar."
& $pythonTechstock -m flask --app app run --host 127.0.0.1 --port $Porta
