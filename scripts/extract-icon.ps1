param(
    [Parameter(Mandatory=$true)]
    [string]$SourcePath,
    [Parameter(Mandatory=$true)]
    [string]$TargetPath,
    [int]$Size = 128
)

# 1. Resolve KnownFolder GUIDs commonly used by Windows Start Menu (Get-StartApps)
$knownFolders = @{
    '{7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E}' = ${env:ProgramFiles(x86)}
    '{6D809377-6AF0-444B-8957-A3773F02200E}' = $env:ProgramFiles
    '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}' = "$env:SystemRoot\System32"
    '{F38BF404-1D43-42F2-9305-67DE0B28FC23}' = $env:SystemRoot
    '{D65231B0-B2F1-4857-A4CE-A8E7C6EA7D27}' = "$env:SystemRoot\SysWOW64"
    '{499EE7CA-7ED5-EBC9-AB09-80DC143D7B90}' = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs"
}

foreach ($guid in $knownFolders.Keys) {
    if ($SourcePath -like "*$guid*") {
        $SourcePath = $SourcePath.Replace($guid, $knownFolders[$guid])
    }
}

# 2. Check if this is a UWP Appx Package (e.g. Microsoft.WindowsCamera_8wekyb3d8bbwe!App)
if ($SourcePath -match '([a-zA-Z0-9\.\-]+)_[a-zA-Z0-9]+!') {
    $pkgName = $Matches[1]
    try {
        $pkg = Get-AppxPackage | Where-Object { $_.Name -like "*$pkgName*" } | Select-Object -First 1
        if ($pkg -and (Test-Path $pkg.InstallLocation)) {
            $candidates = Get-ChildItem -Path $pkg.InstallLocation -Recurse -Filter "*.png" -ErrorAction SilentlyContinue |
                Where-Object { 
                    ($_.Name -match 'logo' -or $_.Name -match 'applist' -or $_.Name -match 'icon' -or $_.Name -match 'tile') -and 
                    ($_.Name -match 'targetsize-(48|64|96|128|256)' -or $_.Name -match 'scale-200' -or $_.Name -match 'scale-400')
                } | Sort-Object Length -Descending

            $best = $candidates | Where-Object { $_.Name -match 'unplated' } | Select-Object -First 1
            if (-not $best) { $best = $candidates | Select-Object -First 1 }
            if ($best) {
                $parent = Split-Path -Parent $TargetPath
                if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
                Copy-Item -Path $best.FullName -Destination $TargetPath -Force
                Write-Output "OK"
                exit 0
            }
        }
    } catch {}
}

# 3. Win32 Executable icon extraction
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
        exit 0
    } else {
        Write-Error "Failed to extract bitmap from: $SourcePath"
        exit 1
    }
} else {
    Write-Error "Source path not found: $SourcePath"
    exit 1
}
