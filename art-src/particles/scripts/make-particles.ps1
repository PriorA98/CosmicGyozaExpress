# Hand-authored pixel particles. Run with Windows PowerShell; no drawing filters.
# Palette glyphs are exact colors; dots leave fully transparent ARGB pixels.
# Star frame 3 deliberately fills its 5px cell to honor the two-pixel arms.
# Sparkle peak uses a 2x2 center and six-pixel span to retain a 1px gutter.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$particleRoot = Split-Path -Parent $PSScriptRoot
$rawDirectory = Join-Path $particleRoot 'raw'
[void](New-Item -ItemType Directory -Force -Path $rawDirectory)
$palette = @{
    W = 'FBF7EC'; Y = 'FCE7A8'; P = 'F4ECDC'; H = 'F9F3E5'
    D = 'ECDFC5'; A = 'D4A055'; E = 'E08A4B'; T = 'C97B5A'
    R = 'A6614A'; B = 'C26954'; C = '9EB6C4'; L = '9B8FB8'
    G = 'B2A5AD' # A quiet warm grey between parchment, dusk-blue and plum.
}
$colors = @{}
foreach ($key in $palette.Keys) {
    $hex = $palette[$key]
    $colors[$key] = [System.Drawing.Color]::FromArgb(255,
        [Convert]::ToInt32($hex.Substring(0, 2), 16),
        [Convert]::ToInt32($hex.Substring(2, 2), 16),
        [Convert]::ToInt32($hex.Substring(4, 2), 16))
}

function New-Sheet([int]$FrameWidth, [int]$FrameHeight, [int]$Count) {
    return [System.Drawing.Bitmap]::new(($FrameWidth * $Count), $FrameHeight,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}

function Set-Cluster {
    param([System.Drawing.Bitmap]$Sheet, [int]$FrameWidth, [int]$Frame,
        [int]$X, [int]$Y, [string]$Pattern, [int]$Alpha = 255)
    $rows = $Pattern.Split('/')
    for ($row = 0; $row -lt $rows.Length; $row++) {
        for ($col = 0; $col -lt $rows[$row].Length; $col++) {
            $glyph = [string]$rows[$row][$col]
            if ($glyph -eq '.') { continue }
            if (-not $colors.ContainsKey($glyph)) { throw "Unknown palette glyph $glyph" }
            $px = $X + $col
            $py = $Y + $row
            if ($px -lt 0 -or $px -ge $FrameWidth -or $py -lt 0 -or $py -ge $Sheet.Height) {
                throw "Pixel outside frame $Frame at $px,$py"
            }
            $Sheet.SetPixel(($Frame * $FrameWidth + $px), $py,
                [System.Drawing.Color]::FromArgb($Alpha, $colors[$glyph]))
        }
    }
}

function Save-Sheet {
    param([System.Drawing.Bitmap]$Sheet, [string]$Name, [int]$FrameWidth,
        [int]$FrameCount, [int]$ExpectedHeight)
    if ($Sheet.Width -ne ($FrameWidth * $FrameCount) -or $Sheet.Height -ne $ExpectedHeight) {
        throw "Incorrect dimensions for $Name"
    }
    # Validate cell gutters, nonempty frames, palette, and absence of noisy specks.
    for ($frame = 0; $frame -lt $FrameCount; $frame++) {
        $count = 0
        for ($y = 0; $y -lt $Sheet.Height; $y++) {
            for ($x = 0; $x -lt $FrameWidth; $x++) {
                $sx = $frame * $FrameWidth + $x
                $pixel = $Sheet.GetPixel($sx, $y)
                if ($pixel.A -eq 0) { continue }
                $count++
                $starTipException = $Name -eq 'star' -and $frame -eq 2
                if (-not $starTipException -and
                    ($x -eq 0 -or $x -eq ($FrameWidth - 1) -or $y -eq 0 -or $y -eq ($Sheet.Height - 1))) {
                    throw "Missing transparent gutter: $Name frame $frame at $x,$y"
                }
                $hasNeighbour = $false
                foreach ($offset in @(@(-1,0), @(1,0), @(0,-1), @(0,1))) {
                    $nx = $x + $offset[0]; $ny = $y + $offset[1]
                    if ($nx -ge 0 -and $nx -lt $FrameWidth -and $ny -ge 0 -and $ny -lt $Sheet.Height) {
                        if ($Sheet.GetPixel(($frame * $FrameWidth + $nx), $ny).A -gt 0) {
                            $hasNeighbour = $true
                        }
                    }
                }
                if (-not $hasNeighbour) { throw "Isolated pixel: $Name frame $frame at $x,$y" }
            }
        }
        if ($count -eq 0) { throw "Empty frame: $Name $frame" }
    }
    $path = Join-Path $rawDirectory "$Name-v1.png"
    $Sheet.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $preview = New-Sheet ($Sheet.Width * 8) ($Sheet.Height * 8) 1
    try {
        # Explicit source-over blending and 8x pixel replication: no interpolation.
        for ($y = 0; $y -lt $Sheet.Height; $y++) {
            for ($x = 0; $x -lt $Sheet.Width; $x++) {
                $pixel = $Sheet.GetPixel($x, $y)
                $a = [int]$pixel.A
                $r = [int][Math]::Round(($pixel.R * $a + 26 * (255 - $a)) / 255.0)
                $g = [int][Math]::Round(($pixel.G * $a + 27 * (255 - $a)) / 255.0)
                $b = [int][Math]::Round(($pixel.B * $a + 46 * (255 - $a)) / 255.0)
                $composite = [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
                for ($dy = 0; $dy -lt 8; $dy++) {
                    for ($dx = 0; $dx -lt 8; $dx++) {
                        $preview.SetPixel(($x * 8 + $dx), ($y * 8 + $dy), $composite)
                    }
                }
            }
        }
        $preview.Save((Join-Path $rawDirectory "$Name-v1-preview8x.png"),
            [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Output "$Name-v1.png $($Sheet.Width)x$($Sheet.Height); preview $($preview.Width)x$($preview.Height)"
    } finally { $preview.Dispose(); $Sheet.Dispose() }
}

# Thrust: aligned rounded shoulders, downward tips, then lower detached clouds.
$sheet = New-Sheet 16 24 8
Set-Cluster $sheet 16 0 5 2 '..AA../.AYYA./AYWWYE/AYWWYE/AYYYEE/.AYYE./.AEEE./..EE../..EE../..TT..'
Set-Cluster $sheet 16 1 4 2 '..AAAA../.AYYYAE./AYWWYYEE/AYWWYYEE/AYWYYYEE/AYYYYEEE/.AYYYEE./.AYYEEE./.AAYEET./..AEET../..AEET../...ET.../...TT...'
Set-Cluster $sheet 16 2 3 3 '...AAAA.../..AYYYAE../.AYWYYYEE./.AYWYYEEE./AAYYYEEEET/AAYYYEEETT/.AYYEEEET./.AAYEEETT./..AEEEET../..AEEETT../...EETT.../...EETT.../...ETT..../....TT..../....TT..../....RR....'
Set-Cluster $sheet 16 3 3 8 '...EEE..../..EAAEE.../.EAAAEEE../EEAAEEEET/EEEEEEETT/EEEEETTTT/.EEETTTTR/.TTTTTTR./..TTTRR../...RRR...'
Set-Cluster $sheet 16 4 2 10 '...TTTT..../..TEEETT.../.TEEEETTT../TTEEEETTTT./TTTEETTTTRR/TTTTTTTTRRR/.TTTTTTRRR./..TTTTRRR../...RRRRR...'
Set-Cluster $sheet 16 5 2 12 '...DDD...../..DPPDD..../.DPPPPDD.../DDPPPDDDG../DDDDDDGGGG./DDDDDGGGGCC/.DDGGGGGCCC/.GGGGGCCCC./..GGCCCLL../...CCLLL...' 190
Set-Cluster $sheet 16 6 1 13 '..DDD......../.DPPDD......./DPPDDGG..GG../DDDDGGG.GGCC./.DDGGGGGGCCC./..GGGGGGGCCC./...GGCCCLCC../....GCCLLL.../.....CLLL....' 120
Set-Cluster $sheet 16 7 4 16 'DD....../DD....../......../....GG../....GC..' 60
Save-Sheet $sheet 'thrust' 16 8 24

# Dust: flattened cloud bases with staggered, overlapping round shoulders.
$sheet = New-Sheet 16 16 6
Set-Cluster $sheet 16 0 5 11 '..PP../.PPPD./PPDDDD/.DDDCC'
Set-Cluster $sheet 16 1 3 9 '...PPP..../..PPPPD.../.PPPPDDD../PPPPDDDDC/PPDDDDDCC/.DDDDCCC.'
Set-Cluster $sheet 16 2 2 7 '..PPP......./.PPPPD..PP../.PPPPDDPPPD./PPPPDDDDDDDC/PPDDDDDDDCCC/DDDDDDDDCCCC/.DDDDDDCCCC./..DDDCCCCC..'
Set-Cluster $sheet 16 3 1 5 '..PPP........./.PPPPD......../PPPPPPD..PPP../PPPPPPDDPPPPD./PPPPPDDDPPDDDC/PPDDDDDDDDDCCC/DDDDDDDDDDDCCC/.DDDDDDDDCCCC./..DDDDDDCCCC../...DDDCCCCC...' 235
Set-Cluster $sheet 16 4 1 5 '..PP....PP..../.PPPD..PPDD.../PPDDD..PDDDC../PDDCC...DCCC../.DCC........../.........DD.../..DD....DDCC../..DC.....CC...' 150
Set-Cluster $sheet 16 5 2 5 'PP........./PD........./.........../.........DD/.........DC/.........../....DD...../....DC.....' 70
Save-Sheet $sheet 'dust' 16 6 16

# Sparkle: fixed central region; the peak broadens to a 2x2 butter/cream heart.
$sheet = New-Sheet 8 8 4
Set-Cluster $sheet 8 0 2 2 '.A./AWA/.A.'
Set-Cluster $sheet 8 1 1 1 '..A../.AYA./AYWYA/.AYA./..A..'
Set-Cluster $sheet 8 2 1 1 '..AA../..YY../AYWWYA/AYWYYA/..YY../..AA..'
Set-Cluster $sheet 8 3 2 2 '.A./AYA/.A.' 120
Save-Sheet $sheet 'sparkle' 8 4 8

# Steam: a gently curving connected ribbon, shaded only along its right side.
$sheet = New-Sheet 12 20 6
Set-Cluster $sheet 12 0 4 15 '.WW./WWWD/WWDC/.DC.' 220
Set-Cluster $sheet 12 1 4 11 '..WW./.WWWD/.WWDC/..WDC/..WDC/.WWC./.WDC.' 225
Set-Cluster $sheet 12 2 3 7 '..WW../.WWWD./.WWDC./..WDC./...WDC/...WDC/..WWC./.WWC../.WDC../..DC..' 220
Set-Cluster $sheet 12 3 3 3 '..WW../.WWWD./.WWDC./.WWC../..WDC./...WDC/...WDC/..WWC./.WWC../.WDC../.WDC../..DC..' 200
Set-Cluster $sheet 12 4 3 2 '.WW../WWWD/WWDC/.DC./...../...WD/...DC/..WD./..DC.' 120
Set-Cluster $sheet 12 5 3 1 'WW./WD./.../.../.WD/.DC' 60
Save-Sheet $sheet 'steam' 12 6 20

# Tiny background star. Only frame 3 touches edges, as required by its 5px cross.
$sheet = New-Sheet 5 5 3
Set-Cluster $sheet 5 0 1 1 '.C./CWC/.C.' 120
Set-Cluster $sheet 5 0 2 2 'W'
Set-Cluster $sheet 5 1 1 1 '.W./WYW/.W.'
Set-Cluster $sheet 5 2 0 0 '..C../...../C...C/...../..C..' 120
Set-Cluster $sheet 5 2 1 1 '.P./PWP/.P.'
Save-Sheet $sheet 'star' 5 3 5
