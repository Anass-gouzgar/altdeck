Add-Type -AssemblyName System.Drawing

function Draw-TabDeckIcon([int]$size, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background gradient
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $cTop = [System.Drawing.Color]::FromArgb(255, 15, 23, 42)
    $cBottom = [System.Drawing.Color]::FromArgb(255, 2, 6, 23)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBottom, 45)
    $g.FillRectangle($brush, $rect)

    # Scale factor
    $scale = $size / 512.0

    # Draw rounded border
    $penCyan = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 6, 182, 212), (6 * $scale))
    $borderRect = New-Object System.Drawing.Rectangle((12 * $scale), (12 * $scale), ($size - 24 * $scale), ($size - 24 * $scale))
    $g.DrawRectangle($penCyan, $borderRect)

    # Key Tiles helper
    $tileBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 30, 41, 59))
    
    # 4 Deck Tiles
    $pad = 65 * $scale
    $tSize = 160 * $scale
    $gap = 62 * $scale

    $t1 = New-Object System.Drawing.Rectangle($pad, $pad, $tSize, $tSize)
    $t2 = New-Object System.Drawing.Rectangle(($pad + $tSize + $gap), $pad, $tSize, $tSize)
    $t3 = New-Object System.Drawing.Rectangle($pad, ($pad + $tSize + $gap), $tSize, $tSize)
    $t4 = New-Object System.Drawing.Rectangle(($pad + $tSize + $gap), ($pad + $tSize + $gap), $tSize, $tSize)

    $g.FillRectangle($tileBrush, $t1)
    $g.FillRectangle($tileBrush, $t2)
    $g.FillRectangle($tileBrush, $t3)
    $g.FillRectangle($tileBrush, $t4)

    # Tile borders
    $p1 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 6, 182, 212), (3 * $scale))
    $p2 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 99, 102, 241), (3 * $scale))
    $p3 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 139, 92, 246), (3 * $scale))
    $p4 = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 236, 72, 153), (3 * $scale))

    $g.DrawRectangle($p1, $t1)
    $g.DrawRectangle($p2, $t2)
    $g.DrawRectangle($p3, $t3)
    $g.DrawRectangle($p4, $t4)

    # Symbols
    # 1: Play Triangle
    $pts1 = @(
        (New-Object System.Drawing.PointF(($pad + 60 * $scale), ($pad + 50 * $scale))),
        (New-Object System.Drawing.PointF(($pad + 110 * $scale), ($pad + 80 * $scale))),
        (New-Object System.Drawing.PointF(($pad + 60 * $scale), ($pad + 110 * $scale)))
    )
    $bCyan = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 56, 189, 248))
    $g.FillPolygon($bCyan, $pts1)

    # 2: Volume Waves / Circle
    $bIndigo = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 129, 140, 248))
    $g.FillEllipse($bIndigo, ($pad + $tSize + $gap + 55 * $scale), ($pad + 55 * $scale), (50 * $scale), (50 * $scale))

    # 3: Sun / Brightness
    $bViolet = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 167, 139, 250))
    $g.FillEllipse($bViolet, ($pad + 55 * $scale), ($pad + $tSize + $gap + 55 * $scale), (50 * $scale), (50 * $scale))

    # 4: Power Bolt
    $bPink = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 244, 114, 182))
    $pts4 = @(
        (New-Object System.Drawing.PointF(($pad + $tSize + $gap + 90 * $scale), ($pad + $tSize + $gap + 40 * $scale))),
        (New-Object System.Drawing.PointF(($pad + $tSize + $gap + 65 * $scale), ($pad + $tSize + $gap + 85 * $scale))),
        (New-Object System.Drawing.PointF(($pad + $tSize + $gap + 85 * $scale), ($pad + $tSize + $gap + 85 * $scale))),
        (New-Object System.Drawing.PointF(($pad + $tSize + $gap + 70 * $scale), ($pad + $tSize + $gap + 120 * $scale))),
        (New-Object System.Drawing.PointF(($pad + $tSize + $gap + 105 * $scale), ($pad + $tSize + $gap + 75 * $scale))),
        (New-Object System.Drawing.PointF(($pad + $tSize + $gap + 85 * $scale), ($pad + $tSize + $gap + 75 * $scale)))
    )
    $g.FillPolygon($bPink, $pts4)

    $g.Dispose()
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created $outPath"
}

Draw-TabDeckIcon 512 "public/icon-512.png"
Draw-TabDeckIcon 192 "public/icon-192.png"
