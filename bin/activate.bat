@echo off
set VIRTUAL_ENV=%~dp0
set VIRTUAL_ENV=%VIRTUAL_ENV:~0,-5%
set CUDDLEFISH_ROOT=%VIRTUAL_ENV%

SET PYTHONKEY=SOFTWARE\Python\PythonCore

rem This kinda sucks - xp has a different output format for reg.exe
rem than vista+ - so first work out the major version number of the OS.
for /f "tokens=2 delims=[]" %%x in ('ver') do set _winversion=%%x
for /f "tokens=2 delims=. " %%G in ('echo %_winversion%') Do (set _winmajor=%%G)
set _winversion=

rem look for 32-bit windows and python, or 64-bit windows and python

SET PYTHONVERSION=2.7
call:CheckPython PYTHONINSTALL %PYTHONKEY%\%PYTHONVERSION%\InstallPath
if "%PYTHONINSTALL%" NEQ "" goto FoundPython

SET PYTHONVERSION=2.6
call:CheckPython PYTHONINSTALL %PYTHONKEY%\%PYTHONVERSION%\InstallPath
if "%PYTHONINSTALL%" NEQ "" goto FoundPython

SET PYTHONVERSION=2.5
call:CheckPython PYTHONINSTALL %PYTHONKEY%\%PYTHONVERSION%\InstallPath
if "%PYTHONINSTALL%" NEQ "" goto FoundPython

SET PYTHONVERSION=2.4
call:CheckPython PYTHONINSTALL %PYTHONKEY%\%PYTHONVERSION%\InstallPath
if "%PYTHONINSTALL%" NEQ "" goto FoundPython

if not defined ProgramFiles(x86) goto win32

rem look for 32-bit python on 64-bit windows

SET PYTHONKEY=SOFTWARE\Wow6432Node\Python\PythonCore

SET PYTHONVERSION=2.7
call:CheckPython PYTHONINSTALL %PYTHONKEY%\%PYTHONVERSION%\InstallPath
if "%PYTHONINSTALL%" NEQ "" goto FoundPython

SET PYTHONVERSION=2.6
call:CheckPython PYTHONINSTALL %PYTHONKEY%\%PYTHONVERSION%\InstallPath
if "%PYTHONINSTALL%" NEQ "" goto FoundPython

SET PYTHONVERSION=2.5
call:CheckPython PYTHONINSTALL %PYTHONKEY%\%PYTHONVERSION%\InstallPath
if "%PYTHONINSTALL%" NEQ "" goto FoundPython

SET PYTHONVERSION=2.4
call:CheckPython PYTHONINSTALL %PYTHONKEY%\%PYTHONVERSION%\InstallPath
if "%PYTHONINSTALL%" NEQ "" goto FoundPython

:win32

SET PYTHONVERSION=
set PYTHONKEY=
echo Warning: Failed to find Python installation directory
goto :EOF

:FoundPython

if defined _OLD_PYTHONPATH (
    set PYTHONPATH=%_OLD_PYTHONPATH%
)
if not defined PYTHONPATH (
    set PYTHONPATH=;
)
set _OLD_PYTHONPATH=%PYTHONPATH%
set PYTHONPATH=%VIRTUAL_ENV%\python-lib;%PYTHONPATH%

if not defined PROMPT (
    set PROMPT=$P$G
)

if defined _OLD_VIRTUAL_PROMPT (
    set PROMPT=%_OLD_VIRTUAL_PROMPT%
)

set _OLD_VIRTUAL_PROMPT=%PROMPT%
set PROMPT=(%VIRTUAL_ENV%) %PROMPT%

if defined _OLD_VIRTUAL_PATH goto OLDPATH
goto SKIPPATH
:OLDPATH
PATH %_OLD_VIRTUAL_PATH%

:SKIPPATH
set _OLD_VIRTUAL_PATH=%PATH%
PATH %VIRTUAL_ENV%\bin;%PYTHONINSTALL%;%PATH%
set PYTHONKEY=
set PYTHONINSTALL=
set PYTHONVERSION=
set key=
set reg=
set _winmajor=
set _tokens=
cd "%VIRTUAL_ENV%"
python -c "from jetpack_sdk_env import welcome; welcome()"
GOTO :EOF

:CheckPython
::CheckPython(retVal, key)
::Reads the registry at %2% and checks if a Python exists there.
::Checks both HKLM and HKCU, then checks the executable actually exists.
SET key=%2%
SET "%~1="
SET reg=reg
rem The string we want is token 3 in vista+, or 4 in xp.
if "%_winmajor%" LSS "6" (set "_tokens=4") ELSE (set "_tokens=3")
if defined ProgramFiles(x86) (
  rem 32-bit cmd on 64-bit windows
  if exist %WINDIR%\sysnative\reg.exe SET reg=%WINDIR%\sysnative\reg.exe
)
FOR /F "usebackq tokens=%_tokens%* skip=1 delims=	 " %%A IN (`%reg% QUERY HKLM\%key% /ve 2^>NUL`) DO SET "%~1=%%A"
if exist %PYTHONINSTALL%\python.exe goto :EOF
rem It may be a 32bit Python directory built from source, in which case the
rem executable is in the PCBuild directory.
if exist %PYTHONINSTALL%\PCBuild\python.exe (set "PYTHONINSTALL=%PYTHONINSTALL%\PCBuild" & goto :EOF)
rem Or maybe a 64bit build directory.
if exist %PYTHONINSTALL%\PCBuild\amd64\python.exe (set "PYTHONINSTALL=%PYTHONINSTALL%\PCBuild\amd64" & goto :EOF)

rem And try HKCU
FOR /F "usebackq tokens=%_tokens%* skip=1 delims=	 " %%A IN (`%reg% QUERY HKCU\%key% /ve 2^>NUL`) DO SET "%~1=%%A"
if exist %PYTHONINSTALL%\python.exe goto :EOF
if exist %PYTHONINSTALL%\PCBuild\python.exe (set "PYTHONINSTALL=%PYTHONINSTALL%\PCBuild" & goto :EOF)
if exist %PYTHONINSTALL%\PCBuild\amd64\python.exe (set "PYTHONINSTALL=%PYTHONINSTALL%\PCBuild\amd64" & goto :EOF)
rem can't find it here, so arrange to try the next key
set PYTHONINSTALL=

GOTO :EOF
