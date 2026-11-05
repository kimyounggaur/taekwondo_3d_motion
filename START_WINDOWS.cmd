@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 start_preview.py
  pause
  exit /b
)
where python >nul 2>nul
if not errorlevel 1 (
  python start_preview.py
  pause
  exit /b
)
echo Install Python 3, then run START_WINDOWS.cmd again.
pause
