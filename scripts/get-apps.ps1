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
$result | ConvertTo-Json -Compress
