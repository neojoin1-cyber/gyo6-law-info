@echo off
set "GYO6_ROOT=D:\Codex\gyo6-law-info"
set "GYO6_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%GYO6_NODE%" (
  set "GYO6_NODE=node"
)

"%GYO6_NODE%" "%GYO6_ROOT%\tools\ollama-stack-manager.mjs" start
