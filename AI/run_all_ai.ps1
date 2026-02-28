# Run from AI/ folder: powershell -ExecutionPolicy Bypass -File run_all_ai.ps1

Start-Process powershell -ArgumentList "-NoExit", "-Command", "python stt/main.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python transcript/main.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python summary/main.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python mom/main.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python semantic/main.py"

Write-Host "✅ All AI services launched in separate terminals."