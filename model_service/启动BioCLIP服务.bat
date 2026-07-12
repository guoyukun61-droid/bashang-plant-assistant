@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if exist "%~dp0bioclip.local.bat" call "%~dp0bioclip.local.bat"
if not defined BIOCLIP_HOME set "BIOCLIP_HOME=%~dp0..\models\bioclip"
set "BIOCLIP_DEVICE=cpu"
set "BIOCLIP_TOP_K=10"
set "BIOCLIP_CPU_THREADS=8"
set "PLANT_KNOWLEDGE_BASE=%~dp0..\public\data\plants.json"
set "PLANT_APP_ORIGINS=http://127.0.0.1:5173,http://127.0.0.1:4173"
echo 正在加载 BioCLIP-2，本机为 CPU 推理，首次启动可能需要数分钟...
python -m uvicorn app:app --host 127.0.0.1 --port 8011
pause
