@echo off
title FinanceApp - Backend
set "PATH=C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;%PATH%"
cd /d "C:\Users\Admin\Downloads\finance-app\backend"

if not exist "node_modules" (
    echo  Installation des dependances backend...
    npm install
    if errorlevel 1 (
        echo  ERREUR : npm install backend a echoue.
        pause
        exit /b 1
    )
)

echo  Backend en cours de demarrage sur le port 5001...
node src/server.js
pause
