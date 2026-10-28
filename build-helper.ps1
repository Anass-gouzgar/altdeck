$cscPath = "C:\WINDOWS\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $cscPath)) {
    $cscPath = Get-ChildItem -Path "$env:WINDIR\Microsoft.NET\Framework64\v4*\csc.exe" | Select-Object -First 1 -ExpandProperty FullName
}

if (-not (Test-Path "bin")) {
    New-Item -ItemType Directory -Path "bin" | Out-Null
}

Write-Host "Compiling native/pc-control.cs using $cscPath..."
& $cscPath /target:exe /out:bin\pc-control.exe /r:System.Management.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll native\pc-control.cs

if (Test-Path "bin\pc-control.exe") {
    Write-Host "SUCCESS: bin\pc-control.exe compiled successfully!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Compilation failed." -ForegroundColor Red
}
