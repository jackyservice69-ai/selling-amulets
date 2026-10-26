$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskServer = Join-Path $taskRoot '.tools/mysql-8.0.44-winx64/bin/mysqld.exe'
$taskBase = Join-Path $taskRoot '.tools/mysql-8.0.44-winx64'
$taskData = Join-Path $taskRoot '.tools/mysql-data'
if (-not (Test-Path -LiteralPath $taskServer) -or -not (Test-Path -LiteralPath $taskData)) { throw 'ไม่พบ MySQL portable ที่เตรียมไว้ โปรดติดตั้ง MySQL 8 หรือใช้ Docker Compose' }
if (Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue) { Write-Host 'พอร์ต 3307 เปิดใช้งานอยู่แล้ว'; exit 0 }
Start-Process -FilePath $taskServer -ArgumentList @('--no-defaults', "--basedir=`"$taskBase`"", "--datadir=`"$taskData`"", '--port=3307', '--bind-address=127.0.0.1', '--mysqlx=0', '--default-time-zone=+00:00', '--log-error=mysql-error.log') -WindowStyle Hidden
Write-Host 'เริ่ม MySQL บน 127.0.0.1:3307 แล้ว ตรวจ log ได้ที่ .tools/mysql-data/mysql-error.log'
