@echo off
setlocal
 
title VSCode Dev
 
pushd %~dp0\..
 
:: Dev-only: by default, skip built-in extensions download during preLaunch to avoid long startup in constrained networks.
:: To force a full sync for testing, set VOID_SKIP_BUILTIN_EXTENSIONS_DOWNLOAD=0 or "false" before calling this script.
if "%VOID_SKIP_BUILTIN_EXTENSIONS_DOWNLOAD%"=="" set VOID_SKIP_BUILTIN_EXTENSIONS_DOWNLOAD=1
 
:: Ensure dev assets (node_modules, Electron, out, built-in extensions) are present on first run.
if "%VSCODE_SKIP_PRELAUNCH%"=="" node build/lib/preLaunch.js
 
:: Resolve Electron executable path by scanning .build\electron for any .exe
set "CODE_PATH="
for %%F in (".build\electron\*.exe") do (
	set "CODE_PATH=%%~fF"
	goto :got_code
)
 
:got_code
if "%CODE_PATH%"=="" (
	echo [code.bat] ERROR: Could not find any Electron .exe under .build\electron. Did preLaunch succeed?
	popd
	endlocal
	exit /b 1
)
set "CODE=%CODE_PATH%"
 
:: Manage built-in extensions
if "%~1"=="--builtin" goto builtin
 
:: Configuration
set NODE_ENV=development
set VSCODE_DEV=1
set VSCODE_CLI=1
set ELECTRON_ENABLE_LOGGING=1
set ELECTRON_ENABLE_STACK_DUMPING=1
 
set DISABLE_TEST_EXTENSION="--disable-extension=vscode.vscode-api-tests"
for %%A in (%*) do (
	if "%%~A"=="--extensionTestsPath" (
		set DISABLE_TEST_EXTENSION=""
	)
)
 
:: Launch Code
"%CODE%" . %DISABLE_TEST_EXTENSION% %*
goto end
 
:builtin
"%CODE%" build/builtin
 
:end
 
popd
 
endlocal
