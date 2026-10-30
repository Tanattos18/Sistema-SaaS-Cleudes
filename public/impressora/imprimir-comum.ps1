# Imprime o comprovante numa impressora comum (laser ou jato de tinta, folha A4) pelo driver do Windows.
# Usado pelo agente.js quando o config.json tem "tipo": "comum". Desenha o cupom numa coluna de 48
# caracteres, em fonte de largura fixa, e passa para a próxima folha se o pedido não couber.
# Uso: powershell -ExecutionPolicy Bypass -File imprimir-comum.ps1 -Impressora "HP Laser MFP 432" -Arquivo pedido.json
param(
  [Parameter(Mandatory = $true)][string]$Impressora,
  [Parameter(Mandatory = $true)][string]$Arquivo
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

# Linhas no mesmo formato que o sistema manda para a térmica: { texto, grande, centro, negrito }.
# No PowerShell 5.1 o ConvertFrom-Json devolve a lista inteira como um item só; o ForEach a desfaz.
$linhas = @(Get-Content -LiteralPath $Arquivo -Raw -Encoding UTF8 | ConvertFrom-Json | ForEach-Object { $_ })

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $Impressora
if (-not $doc.PrinterSettings.IsValid) { throw "Impressora '$Impressora' nao encontrada no Windows." }
$doc.DocumentName = "Pedido"

$normal = New-Object System.Drawing.Font("Consolas", 10)
$negrito = New-Object System.Drawing.Font("Consolas", 10, [System.Drawing.FontStyle]::Bold)
$grande = New-Object System.Drawing.Font("Consolas", 16, [System.Drawing.FontStyle]::Bold)
$script:proxima = 0

$doc.add_PrintPage({
  param($sender, $e)
  $g = $e.Graphics
  $area = $e.MarginBounds
  # Largura de 48 caracteres na fonte normal: a mesma coluna da bobina de 80 mm.
  $largura = $g.MeasureString(("0" * 48), $normal).Width
  $x0 = $area.Left
  $y = $area.Top
  while ($script:proxima -lt $linhas.Count) {
    $l = $linhas[$script:proxima]
    $fonte = if ($l.grande) { $grande } elseif ($l.negrito) { $negrito } else { $normal }
    $texto = [string]$l.texto
    $altura = $fonte.GetHeight($g)
    if ($y + $altura -gt $area.Bottom) { $e.HasMorePages = $true; return }
    $x = $x0
    if ($l.centro) { $x = $x0 + [Math]::Max(0, ($largura - $g.MeasureString($texto, $fonte).Width) / 2) }
    $g.DrawString($texto, $fonte, [System.Drawing.Brushes]::Black, $x, $y)
    $y += $altura
    $script:proxima++
  }
  $e.HasMorePages = $false
})

$doc.Print()
$normal.Dispose(); $negrito.Dispose(); $grande.Dispose(); $doc.Dispose()
