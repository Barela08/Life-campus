@echo off
echo ==========================================
echo Starting Life Campus (Backend + Frontend)
echo ==========================================

echo Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "Life Campus Backend" cmd /k "cd /d "%~dp0backend" && .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

echo Starting Vite Frontend on http://localhost:5173 ...
start "Life Campus Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Both servers started!
echo Frontend: http://localhost:5173/
echo Backend API: http://127.0.0.1:8000/docs
echo ==========================================
