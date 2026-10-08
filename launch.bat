@echo off
title FinanceApp - Lancement
color 0A

set "XAMPP=C:\xampp"
set "WORKBENCH=C:\Program Files\MySQL\MySQL Workbench 8.0 CE\MySQLWorkbench.exe"
set "MYSQLD=%XAMPP%\mysql\bin\mysqld.exe"
set "MYINI=%XAMPP%\mysql\bin\my.ini"
set "MYSQL_DATA=%XAMPP%\mysql\data"
set "BACK_DIR=C:\Users\Admin\Downloads\finance-app\backend"
set "FRONT_DIR=C:\Users\Admin\Downloads\finance-app\frontend"

echo.
echo  =============================================
echo   FinanceApp  -  Demarrage
echo  =============================================

:: ─────────────────────────────────────────────
::  ETAPE 1  Nettoyage des processus existants
:: ─────────────────────────────────────────────
echo.
echo  [1/5] Nettoyage des processus...

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5001" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
    echo       Port 5001 libere ^(PID %%a^)
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
    echo       Port 5173 libere ^(PID %%a^)
)
taskkill /IM MySQLWorkbench.exe /F >nul 2>&1

:: Verifier si MySQL tourne deja avant de le toucher
netstat -ano 2>nul | findstr ":3306" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo       MySQL deja actif sur port 3306 - conserve.
    goto SKIP_MYSQL_KILL
)
:: MySQL n'est pas actif : on peut tuer le processus en securite
taskkill /IM mysqld.exe /F >nul 2>&1

:SKIP_MYSQL_KILL
echo       Attente liberation ports (3s)...
timeout /t 3 /nobreak >nul
echo  [OK] Nettoyage termine.

:: ─────────────────────────────────────────────
::  ETAPE 2  Demarrage MySQL
:: ─────────────────────────────────────────────
echo.
echo  [2/5] Demarrage MySQL...

:: Verifier si MySQL repond deja (cas ou on l'a conserve ci-dessus)
netstat -ano 2>nul | findstr ":3306" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo  [OK] MySQL deja pret sur port 3306.
    goto MYSQL_OK
)

:: Verifier que XAMPP est bien installe
if not exist "%MYSQLD%" (
    color 0C
    echo.
    echo  ERREUR : mysqld.exe introuvable dans %XAMPP%\mysql\bin\
    echo  Verifiez que XAMPP est installe en C:\xampp
    echo.
    pause
    exit /b 1
)

:: Supprimer le fichier PID residuel qui bloque le demarrage
if exist "%MYSQL_DATA%\*.pid" (
    del /f /q "%MYSQL_DATA%\*.pid" >nul 2>&1
    echo       Fichier PID residuel supprime.
)

:: Lancer mysqld
start "MySQL-XAMPP" /min "%MYSQLD%" --defaults-file="%MYINI%"

echo       Attente MySQL sur port 3306 (max 45s)...
set WAIT=0
:WAIT_MYSQL
netstat -ano 2>nul | findstr ":3306" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto MYSQL_OK
set /a WAIT+=1
if %WAIT% GEQ 45 (
    color 0C
    echo.
    echo  ERREUR : MySQL ne repond pas apres 45 secondes.
    echo.
    echo  Solutions possibles :
    echo    1. Ouvrez XAMPP Control Panel et demarrez MySQL manuellement
    echo    2. Verifiez C:\xampp\mysql\data\ pour des fichiers .pid a supprimer
    echo    3. Consultez C:\xampp\mysql\data\mysql_error.log
    echo.
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
goto WAIT_MYSQL

:MYSQL_OK
echo  [OK] MySQL pret sur port 3306.

:: ─────────────────────────────────────────────
::  ETAPE 3  Demarrage MySQL Workbench
:: ─────────────────────────────────────────────
echo.
echo  [3/5] Demarrage MySQL Workbench...
if exist "%WORKBENCH%" (
    start "" "%WORKBENCH%"
    echo  [OK] MySQL Workbench lance.
) else (
    echo  [--] Workbench introuvable - ignore.
)

:: ─────────────────────────────────────────────
::  PREPARATION  Verification pre-lancement
:: ─────────────────────────────────────────────

:: Verifier fichier .env backend
if not exist "%BACK_DIR%\.env" (
    color 0E
    echo.
    echo  AVERTISSEMENT : Le fichier .env est manquant dans le backend.
    echo  Copiez %BACK_DIR%\.env.example en .env
    echo  et configurez vos parametres DB avant de continuer.
    echo.
    pause
    exit /b 1
)

:: Creer le dossier uploads si necessaire
if not exist "%BACK_DIR%\uploads\depenses" (
    mkdir "%BACK_DIR%\uploads\depenses" >nul 2>&1
    echo  [OK] Dossier uploads\depenses cree.
)

:: ─────────────────────────────────────────────
::  ETAPE 4  Demarrage Backend et Frontend
:: ─────────────────────────────────────────────
echo.
echo  [4/5] Demarrage Backend...
start "FinanceApp-Backend" "C:\Users\Admin\Downloads\finance-app\start_backend.bat"

set WAIT=0
:WAIT_BACKEND
netstat -ano 2>nul | findstr ":5001" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto BACKEND_OK
set /a WAIT+=1
if %WAIT% GEQ 30 (
    color 0C
    echo.
    echo  ERREUR : Backend non demarre. Verifiez la fenetre FinanceApp-Backend.
    echo.
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
goto WAIT_BACKEND
:BACKEND_OK
echo  [OK] Backend pret sur port 5001.

echo.
echo       Demarrage Frontend...
start "FinanceApp-Frontend" "C:\Users\Admin\Downloads\finance-app\start_frontend.bat"

set WAIT=0
:WAIT_FRONTEND
netstat -ano 2>nul | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto FRONTEND_OK
set /a WAIT+=1
if %WAIT% GEQ 30 (
    color 0C
    echo.
    echo  ERREUR : Frontend non demarre. Verifiez la fenetre FinanceApp-Frontend.
    echo.
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
goto WAIT_FRONTEND
:FRONTEND_OK
echo  [OK] Frontend pret sur port 5173.

:: ─────────────────────────────────────────────
::  ETAPE 5  Ouverture navigateur
:: ─────────────────────────────────────────────
echo.
echo  [5/5] Ouverture du navigateur...
start "" http://localhost:5173

echo.
color 2F
echo  =============================================
echo   Tous les services sont operationnels !
echo  =============================================
echo   MySQL     port 3306   OK
echo   Backend   port 5001   OK
echo   Frontend  port 5173   OK
echo  =============================================
echo.
echo  Appuyez sur une touche pour fermer...
pause >nul
exit /b 0
