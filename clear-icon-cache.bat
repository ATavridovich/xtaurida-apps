@echo off
echo Clearing Windows icon cache...
echo.

taskkill /f /im explorer.exe

timeout /t 2 /nobreak > NUL

cd /d %userprofile%\AppData\Local\Microsoft\Windows\Explorer
attrib -h IconCache.db
del IconCache.db
attrib -h iconcache_*.db
del iconcache_*.db

echo.
echo Icon cache cleared!
echo Restarting Explorer...
start explorer.exe

echo Done!
pause
