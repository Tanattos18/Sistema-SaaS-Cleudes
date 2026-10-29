# Envia bytes ESC/POS direto (RAW) para uma impressora instalada no Windows, sem passar pelo
# desenho do driver. Usado pelo agente.js quando o config.json tem "tipo": "windows".
# Uso: powershell -ExecutionPolicy Bypass -File imprimir-windows.ps1 -Impressora "EPSON TM-T88V Receipt" -Arquivo pedido.bin
param(
  [Parameter(Mandatory = $true)][string]$Impressora,
  [Parameter(Mandatory = $true)][string]$Arquivo
)
$ErrorActionPreference = "Stop"

if (-not ("ImpressoraRaw" -as [type])) {
  Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class ImpressoraRaw {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool OpenPrinter(string nome, out IntPtr h, IntPtr padrao);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool StartDocPrinter(IntPtr h, int nivel, [In] DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)]
  static extern bool WritePrinter(IntPtr h, byte[] dados, int tamanho, out int escritos);

  public static void Enviar(string impressora, byte[] dados) {
    IntPtr h;
    if (!OpenPrinter(impressora, out h, IntPtr.Zero))
      throw new Exception("Impressora '" + impressora + "' nao encontrada (erro " + Marshal.GetLastWin32Error() + ").");
    try {
      DOCINFO di = new DOCINFO();
      di.pDocName = "Pedido";
      di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, di)) throw new Exception("Falha ao iniciar a impressao (erro " + Marshal.GetLastWin32Error() + ").");
      try {
        StartPagePrinter(h);
        int escritos;
        if (!WritePrinter(h, dados, dados.Length, out escritos) || escritos != dados.Length)
          throw new Exception("Falha ao enviar os dados (erro " + Marshal.GetLastWin32Error() + ").");
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
"@
}

[ImpressoraRaw]::Enviar($Impressora, [System.IO.File]::ReadAllBytes($Arquivo))
