@echo off
REM VXT Mobile Android Build Script - Fast deployment
REM

echo.
echo ===== VXT Mobile - Build & Deploy to Note20 =====
echo.
echo [1/3] Navigating to project...
cd /d c:\VXT\vxt-mobile
if errorlevel 1 (
  echo ERROR: Could not change to vxt-mobile directory
  exit /b 1
)
echo OK - At: %CD%

echo.
echo [2/3] Verifying build files...
if not exist android\app\build.gradle (
  echo ERROR: build.gradle not found
  exit /b 1
)
echo OK - Build files verified

echo.
echo [3/3] Building and deploying...
echo This may take 5-10 minutes...
echo.

call npm run android

if errorlevel 1 (
  echo.
  echo ERROR: Build failed
  echo Check the gradle output above for details
  exit /b 1
) else (
  echo.
  echo SUCCESS: Build completed and app deployed to Note20!
)
