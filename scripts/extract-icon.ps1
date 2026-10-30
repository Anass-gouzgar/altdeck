param(
    [Parameter(Mandatory=$true)]
    [string]$SourcePath,
    [Parameter(Mandatory=$true)]
    [string]$TargetPath,
    [int]$Size = 128
)

Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Runtime.InteropServices;

public class WinIconHelper {
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern uint PrivateExtractIcons(string lpszFile, int nIconIndex, int cxIcon, int cyIcon, IntPtr[] phicon, uint[] piconid, uint nIcons, uint flags);

    [DllImport("user32.dll")]
    public static extern bool DestroyIcon(IntPtr hIcon);

    public static Bitmap Extract(string file, int size) {
        try {
            IntPtr[] phicon = new IntPtr[1];
            uint[] piconid = new uint[1];
            uint count = PrivateExtractIcons(file, 0, size, size, phicon, piconid, 1, 0);
            if (count > 0 && phicon[0] != IntPtr.Zero) {
                Icon icon = Icon.FromHandle(phicon[0]);
                Bitmap bmp = (Bitmap)icon.ToBitmap().Clone();
                DestroyIcon(phicon[0]);
                return bmp;
            }
        } catch {}
        try {
            Icon assoc = Icon.ExtractAssociatedIcon(file);
            if (assoc != null) {
                Bitmap bmp = (Bitmap)assoc.ToBitmap().Clone();
                assoc.Dispose();
                return bmp;
            }
        } catch {}
        return null;
    }
}
"@ -ReferencedAssemblies System.Drawing

if (Test-Path $SourcePath) {
    $bmp = [WinIconHelper]::Extract($SourcePath, $Size)
    if ($bmp) {
        $parent = Split-Path -Parent $TargetPath
        if ($parent -and !(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        $bmp.Save($TargetPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Output "OK"
    } else {
        Write-Error "Failed to extract bitmap"
    }
} else {
    Write-Error "Source path not found: $SourcePath"
}
