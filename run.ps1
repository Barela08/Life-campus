# Life Campus Startup Script for PowerShell
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Starting Life Campus (Backend + Frontend) " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "Starting FastAPI Backend on http://127.0.0.1:8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ScriptDir\backend'; .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

Write-Host "Starting Vite Frontend on http://localhost:5173 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ScriptDir\frontend'; npm run dev"

Write-Host "`nBoth servers started successfully!" -ForegroundColor Yellow
Write-Host "Frontend URL:  http://localhost:5173/" -ForegroundColor Cyan
Write-Host "Backend API:   http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
