@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动坝上植物实习小助手...
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:4173/
  python -m http.server 4173 --directory dist
  goto :eof
)
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:4173/
  py -3 -m http.server 4173 --directory dist
  goto :eof
)
echo 未检测到 Python。请安装 Python 3，或按部署文档使用 Node.js 启动。
pause
