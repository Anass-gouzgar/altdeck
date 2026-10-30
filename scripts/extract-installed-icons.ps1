# Script to extract official icons for installed applications into public/icons
$iconsDir = Join-Path $PSScriptRoot "..\public\icons"
if (-not (Test-Path $iconsDir)) { New-Item -ItemType Directory -Path $iconsDir -Force }

Add-Type -AssemblyName System.Drawing

function ExtractExeIcon([string]$exePath, [string]$targetPng) {
    if (-not (Test-Path $exePath)) { 
        Write-Host "File not found: $exePath"
        return $false 
    }
    try {
        $csharp = @"
using System;
using System.Drawing;
using System.Runtime.InteropServices;

public class Win32IconExtractor
{
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern uint PrivateExtractIcons(
        string lpszFile,
        int nIconIndex,
        int cxIcon,
        int cyIcon,
        IntPtr[] phicon,
        uint[] piconid,
        uint nIcons,
        uint flags);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool DestroyIcon(IntPtr hIcon);

    public static Bitmap ExtractBest(string file, int size)
    {
        IntPtr[] phicon = new IntPtr[1];
        uint[] piconid = new uint[1];
        uint count = PrivateExtractIcons(file, 0, size, size, phicon, piconid, 1, 0);
        if (count > 0 && phicon[0] != IntPtr.Zero)
        {
            try
            {
                using (Icon ico = Icon.FromHandle(phicon[0]))
                {
                    return ico.ToBitmap();
                }
            }
            finally
            {
                DestroyIcon(phicon[0]);
            }
        }
        return null;
    }
}
"@
        if (-not ([System.Management.Automation.PSTypeName]'Win32IconExtractor').Type) {
            Add-Type -TypeDefinition $csharp -ReferencedAssemblies System.Drawing
        }

        $bmp = [Win32IconExtractor]::ExtractBest($exePath, 256)
        if ($null -eq $bmp) {
            $bmp = [Win32IconExtractor]::ExtractBest($exePath, 128)
        }
        if ($null -eq $bmp) {
            $ico = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)
            if ($ico) {
                $bmp = $ico.ToBitmap()
                $ico.Dispose()
            }
        }
        if ($bmp) {
            $bmp.Save($targetPng, [System.Drawing.Imaging.ImageFormat]::Png)
            $bmp.Dispose()
            Write-Host "Extracted: $targetPng"
            return $true
        }
    } catch {
        Write-Host "Error extracting $exePath : $_"
    }
    return $false
}

function ExtractUwpApp([string]$packageNameMatch, [string]$targetPng) {
    try {
        $pkg = Get-AppxPackage | Where-Object { $_.Name -like "*$packageNameMatch*" } | Select-Object -First 1
        if (-not $pkg) {
            Write-Host "UWP Package not found for: $packageNameMatch"
            return $false
        }
        $loc = $pkg.InstallLocation
        $candidates = Get-ChildItem -Path $loc -Recurse -Filter "*.png" -ErrorAction SilentlyContinue |
            Where-Object { 
                ($_.Name -match 'logo' -or $_.Name -match 'applist' -or $_.Name -match 'icon' -or $_.Name -match 'tile') -and 
                ($_.Name -match 'targetsize-(48|64|96|128|256)' -or $_.Name -match 'scale-200' -or $_.Name -match 'scale-400') -and
                ($_.Name -notmatch 'contrast-white' -or $_.Name -notmatch 'contrast-black')
            } | Sort-Object Length -Descending

        # Try unplated first
        $best = $candidates | Where-Object { $_.Name -match 'unplated' } | Select-Object -First 1
        if (-not $best) {
            $best = $candidates | Select-Object -First 1
        }
        if ($best) {
            Copy-Item -Path $best.FullName -Destination $targetPng -Force
            Write-Host "Copied UWP icon: $targetPng (from $($best.FullName))"
            return $true
        } else {
            # Any PNG in assets
            $any = Get-ChildItem -Path $loc -Recurse -Filter "*.png" -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 1
            if ($any) {
                Copy-Item -Path $any.FullName -Destination $targetPng -Force
                Write-Host "Copied fallback UWP icon: $targetPng"
                return $true
            }
        }
    } catch {
        Write-Host "Error extracting UWP $packageNameMatch : $_"
    }
    return $false
}

# 1. Direct Win32 EXEs
ExtractExeIcon "C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE" (Join-Path $iconsDir "excel.png")
ExtractExeIcon "C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE" (Join-Path $iconsDir "word.png")
ExtractExeIcon "C:\Program Files\Microsoft Office\root\Office16\POWERPNT.EXE" (Join-Path $iconsDir "powerpoint.png")
ExtractExeIcon "C:\Program Files\Microsoft Office\root\Office16\OUTLOOK.EXE" (Join-Path $iconsDir "outlook.png")
ExtractExeIcon "C:\Program Files\Microsoft Office\root\Office16\ONENOTE.EXE" (Join-Path $iconsDir "onenote.png")
ExtractExeIcon "C:\Program Files (x86)\SADP\SADP\SADPTool.exe" (Join-Path $iconsDir "sadp.png")
ExtractExeIcon "C:\Windows\System32\cmd.exe" (Join-Path $iconsDir "cmd.png")
ExtractExeIcon "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" (Join-Path $iconsDir "powershell.png")
ExtractExeIcon "C:\Program Files\Git\cmd\git-gui.exe" (Join-Path $iconsDir "git.png")
ExtractExeIcon "C:\Users\Anass\AppData\Local\Programs\Ollama\ollama app.exe" (Join-Path $iconsDir "ollama.png")

# 2. UWP / Store Apps
ExtractUwpApp "Microsoft.WindowsCamera" (Join-Path $iconsDir "camera.png")
ExtractUwpApp "MSTeams" (Join-Path $iconsDir "teams.png")
ExtractUwpApp "Microsoft.Paint" (Join-Path $iconsDir "paint.png")
ExtractUwpApp "Microsoft.ScreenSketch" (Join-Path $iconsDir "snippingtool.png")
ExtractUwpApp "Microsoft.Windows.Photos" (Join-Path $iconsDir "photos.png")
ExtractUwpApp "Microsoft.ZuneMusic" (Join-Path $iconsDir "mediaplayer.png")
ExtractUwpApp "Microsoft.GamingApp" (Join-Path $iconsDir "xbox.png")
ExtractUwpApp "Microsoft.WindowsStore" (Join-Path $iconsDir "store.png")
ExtractUwpApp "Clipchamp" (Join-Path $iconsDir "clipchamp.png")
ExtractUwpApp "Microsoft.BingWeather" (Join-Path $iconsDir "weather.png")

Write-Host "Completed icon extraction."
