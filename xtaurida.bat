@echo off
setlocal

set "XTAURIDA_ROOT=%~dp0"
set "XTAURIDA_EXE=%XTAURIDA_ROOT%.build\electron\xTaurida Apps.exe"
set "XTAURIDA_RESOURCES=%XTAURIDA_ROOT%resources\app"

:: Check if resources/app exists, if not use current directory
if not exist "%XTAURIDA_RESOURCES%" (
    set "XTAURIDA_RESOURCES=%XTAURIDA_ROOT%."
)

:: Configuration
set NODE_ENV=development
set VSCODE_DEV=1
set VSCODE_CLI=1
set ELECTRON_ENABLE_LOGGING=1

:: Launch xTaurida Apps with all arguments passed through
"%XTAURIDA_EXE%" "%XTAURIDA_RESOURCES%" %*

endlocal
