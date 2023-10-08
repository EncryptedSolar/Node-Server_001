
@echo off
start wt -M -d "D:\Programming\nodeServer" cmd /k "npm run grpc1" ; split-pane -d "D:\Programming\nodeServer" cmd /k "npm run grpc2"


//wt -p "Command Prompt" ; split-pane -p "Windows PowerShell" ; split-pane -H 

