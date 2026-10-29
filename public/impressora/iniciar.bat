@echo off
REM Programa de impressao do balcao. Dois cliques para iniciar; "iniciar.bat teste" imprime uma pagina de teste.
cd /d "%~dp0"
title Impressao de pedidos - nao feche esta janela
where node >nul 2>nul
if errorlevel 1 (
  echo O Node.js nao esta instalado. Baixe em https://nodejs.org/pt e instale a versao LTS.
  pause
  exit /b 1
)
if /i "%~1"=="teste" (
  node agente.js teste
  pause
  exit /b
)
:loop
node agente.js
echo O programa parou. Reiniciando em 10 segundos...
timeout /t 10 /nobreak >nul
goto loop
