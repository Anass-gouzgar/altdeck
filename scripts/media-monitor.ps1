# AltDeck WinRT Media Transport Monitor & Controller
# Streams real-time media title, artist, playback status, duration, and position to Node.js stdout
param(
    [string]$Mode = "stream",
    [double]$SeekTo = -1
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
})[0]

Function Await-WinRT($winRtAsync, $resultType) {
    if ($null -eq $winRtAsync) { return $null }
    try {
        $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
        $netTask = $asTask.Invoke($null, @($winRtAsync))
        $netTask.Wait(3000) | Out-Null
        return $netTask.Result
    } catch {
        return $null
    }
}

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media, ContentType = WindowsRuntime] | Out-Null

$op = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
$mgr = Await-WinRT $op ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

if (-not $mgr) {
    Write-Output '{"status":"error","message":"WinRT SMTC manager not available"}'
    exit 1
}

Function Get-MediaData {
    $session = $mgr.GetCurrentSession()
    $all = $mgr.GetSessions()
    if ($all -and $all.Count -gt 1) {
        $playingSession = $all | Where-Object { 
            try { ($_.GetPlaybackInfo()).PlaybackStatus.ToString() -eq "Playing" } catch { $false }
        } | Select-Object -First 1
        if ($playingSession) {
            $session = $playingSession
        }
    }
    if (-not $session -and $all -and $all.Count -gt 0) {
        $session = $all[0]
    }

    if (-not $session) {
        return @{
            status = "idle"
            hasMedia = $false
            title = ""
            artist = ""
            album = ""
            playbackStatus = "Stopped"
            position = 0
            duration = 0
        }
    }

    $propsOp = $session.TryGetMediaPropertiesAsync()
    $props = Await-WinRT $propsOp ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $timeline = $session.GetTimelineProperties()
    $playback = $session.GetPlaybackInfo()

    $status = if ($playback) { $playback.PlaybackStatus.ToString() } else { "Unknown" }

    $pos = 0
    $dur = 0
    if ($timeline) {
        $pos = $timeline.Position.TotalSeconds
        $dur = [Math]::Round($timeline.EndTime.TotalSeconds, 1)
        if ($status -eq "Playing" -and $timeline.LastUpdatedTime) {
            $elapsed = ([DateTimeOffset]::UtcNow - $timeline.LastUpdatedTime.ToUniversalTime()).TotalSeconds
            if ($elapsed -gt 0) {
                $pos = $pos + $elapsed
            }
        }
        if ($dur -gt 0 -and $pos -gt $dur) {
            $pos = $dur
        }
        $pos = [Math]::Round($pos, 1)
    }

    $title = if ($props) { $props.Title } else { "" }
    $artist = if ($props) { $props.Artist } else { "" }
    $album = if ($props) { $props.AlbumTitle } else { "" }

    return @{
        status = "ok"
        hasMedia = ($title.Length -gt 0)
        title = $title
        artist = $artist
        album = $album
        playbackStatus = $status
        position = $pos
        duration = $dur
        appId = $session.SourceAppId
    }
}

Function Seek-Media($sec) {
    $session = $mgr.GetCurrentSession()
    $all = $mgr.GetSessions()
    if ($all -and $all.Count -gt 1) {
        $playingSession = $all | Where-Object { 
            try { ($_.GetPlaybackInfo()).PlaybackStatus.ToString() -eq "Playing" } catch { $false }
        } | Select-Object -First 1
        if ($playingSession) {
            $session = $playingSession
        }
    }
    if (-not $session -and $all -and $all.Count -gt 0) {
        $session = $all[0]
    }

    if ($session) {
        $ticks = [long]($sec * 10000000)
        $seekOp = $session.TryChangePlaybackPositionAsync($ticks)
        $success = Await-WinRT $seekOp ([bool])
        return @{ status = "ok"; seek = $sec; success = [bool]$success }
    }
    return @{ status = "no_media" }
}

if ($SeekTo -ge 0) {
    $res = Seek-Media $SeekTo
    $res | ConvertTo-Json -Compress
    exit 0
}

if ($Mode -eq "oneshot") {
    $data = Get-MediaData
    $data | ConvertTo-Json -Compress
    exit 0
}

# Continuous Stream Mode (Unblocked stdout line streaming with auto-flush)
$lastJson = ""
while ($true) {
    $data = Get-MediaData
    $json = $data | ConvertTo-Json -Compress
    if ($json -ne $lastJson) {
        Write-Output $json
        [Console]::Out.Flush()
        $lastJson = $json
    }
    Start-Sleep -Milliseconds 750
}
