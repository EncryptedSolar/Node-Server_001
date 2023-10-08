@echo off

REM Kill all node.exe processes except for the one associated with your build script
for /f "tokens=2" %%a in ('tasklist ^| findstr /i /c:"node.exe" /c:"BUILD_PROCESS=yes"') do (
  taskkill /F /PID %%a
)

REM Close the terminal window (Windows Terminal)
taskkill /F /IM WindowsTerminal.exe

REM Start the build watch process using Node.js
start cmd /k "npm run watch"




//REM Close the terminal window
//taskkill /F /IM WindowsTerminal.exe


// taskkill /F /IM cmd.exe

//REM Stop server 1
//taskkill /F /IM node.exe /T

//REM Add more server stop commands as needed