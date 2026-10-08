@echo off
title FinanceApp - Frontend
set "PATH=C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;%PATH%"
cd /d "C:\Users\Admin\Downloads\finance-app\frontend"

if not exist "node_modules" (
    echo  Installation des dependances frontend...
    npm install
    if errorlevel 1 (
        echo  ERREUR : npm install frontend a echoue.
        pause
        exit /b 1
    )
)

echo  Frontend en cours de demarrage sur le port 5173...
npm run dev
pause
