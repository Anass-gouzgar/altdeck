# Force UTF-8 output encoding for non-ASCII and Arabic Windows applications
try {
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [Console]::OutputEncoding = $utf8NoBom
    $OutputEncoding = $utf8NoBom
} catch {}

$apps = Get-StartApps | Where-Object { 
    $_.AppID -notmatch '^https?://' -and 
    $_.AppID -notmatch '\.(html|htm|pdf|url)$' -and
    $_.Name -notmatch '(?i)uninstall' -and
    $_.Name -notmatch '(?i)release notes' -and
    $_.Name -notmatch '(?i)user manual'
} | Sort-Object Name

$result = @()
foreach ($app in $apps) {
    $result += [PSCustomObject]@{
        name = $app.Name
        appId = $app.AppID
    }
}
[Console]::WriteLine(($result | ConvertTo-Json -Compress))
[Console]::Out.Flush()
