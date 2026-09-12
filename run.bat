@echo off
title Dynamic Island for Windows
chcp 65001 >nul
cls
echo =======================================================
echo              DYNAMIC ISLAND FOR WINDOWS
echo =======================================================
echo.
echo [*] Dang kiem tra va dong tien trinh cu neu co...
taskkill /F /IM app.exe >nul 2>&1

echo [*] Dang khoi chay Dynamic Island (Release Mode)...
start "" "%~dp0src-tauri\target\release\app.exe"

echo.
echo [OK] KHOI CHAY THANH CONG!
echo [!] Dynamic Island dang noi o VIEN TREN CUNG GIUA MAN HINH cua ban.
echo [*] Meo su dung:
echo     - Click chuot trai de mo RAM ^& Volume HUD / Bat nhac
echo     - Click chuot phai vao dao de mo Menu tinh nang day du
echo     - Bam phim Tang/Giam am luong hoac Caps Lock de thay hieu ung Apple
echo.
echo Cua so nay se tu dong dong sau 2 giay...
timeout /t 2 /nobreak >nul
exit
