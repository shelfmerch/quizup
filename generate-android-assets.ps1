Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName System.Drawing

$srcPath = "d:\quizup\quiz-blitz-arena\public\branding\quizup-icon.png"
$resDir = "d:\quizup\quiz-blitz-arena\android\app\src\main\res"

# 1. Decode WebP and convert to PNG bytes
$fileStream = New-Object System.IO.FileStream($srcPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
$decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create($fileStream, [System.Windows.Media.Imaging.BitmapCreateOptions]::None, [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
$encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
$encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($decoder.Frames[0]))
$ms = New-Object System.IO.MemoryStream
$encoder.Save($ms)
$pngBytes = $ms.ToArray()
$ms.Close()
$fileStream.Close()

# Load into GDI+ Bitmap
$ms2 = New-Object System.IO.MemoryStream(,$pngBytes)
$srcBmp = [System.Drawing.Bitmap]::FromStream($ms2)

# Helper to save resized image
function Save-Resized-Icon($width, $height, $targetPath) {
    $destBmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcBmp, 0, 0, $width, $height)
    $g.Dispose()
    
    # Ensure parent dir exists
    $parentDir = [System.IO.Path]::GetDirectoryName($targetPath)
    if (!(Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    
    $destBmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Output "Saved: $targetPath"
}

# Helper to save adaptive foreground
function Save-Adaptive-Foreground($canvasSize, $logoSize, $targetPath) {
    $destBmp = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $x = ($canvasSize - $logoSize) / 2
    $y = ($canvasSize - $logoSize) / 2
    $g.DrawImage($srcBmp, $x, $y, $logoSize, $logoSize)
    $g.Dispose()
    
    $parentDir = [System.IO.Path]::GetDirectoryName($targetPath)
    if (!(Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    
    $destBmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Output "Saved foreground: $targetPath"
}

# Helper to save splash screen
function Save-Splash($width, $height, $targetPath) {
    $destBmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # Fill background with red (#f65357)
    $redColor = [System.Drawing.ColorTranslator]::FromHtml("#f65357")
    $g.Clear($redColor)
    
    # Scale logo size based on screen width
    $logoSize = [Math]::Min($width * 0.35, 250)
    if ($logoSize -lt 96) { $logoSize = 96 }
    
    $x = ($width - $logoSize) / 2
    $y = ($height - $logoSize) / 2
    $g.DrawImage($srcBmp, $x, $y, $logoSize, $logoSize)
    $g.Dispose()
    
    $parentDir = [System.IO.Path]::GetDirectoryName($targetPath)
    if (!(Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    
    $destBmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Output "Saved splash: $targetPath ($width x $height)"
}

# --- Generate Legacy Icons ---
$densities = @{
    "mdpi" = 48
    "hdpi" = 72
    "xhdpi" = 96
    "xxhdpi" = 144
    "xxxhdpi" = 192
}
foreach ($name in $densities.Keys) {
    $size = $densities[$name]
    Save-Resized-Icon $size $size "$resDir\mipmap-$name\ic_launcher.png"
    Save-Resized-Icon $size $size "$resDir\mipmap-$name\ic_launcher_round.png"
}

# --- Generate Adaptive Foreground Icons ---
$adaptiveDensities = @{
    "mdpi" = @{ "canvas" = 108; "logo" = 66 }
    "hdpi" = @{ "canvas" = 162; "logo" = 99 }
    "xhdpi" = @{ "canvas" = 216; "logo" = 132 }
    "xxhdpi" = @{ "canvas" = 324; "logo" = 198 }
    "xxxhdpi" = @{ "canvas" = 432; "logo" = 264 }
}
foreach ($name in $adaptiveDensities.Keys) {
    $canvas = $adaptiveDensities[$name]["canvas"]
    $logo = $adaptiveDensities[$name]["logo"]
    Save-Adaptive-Foreground $canvas $logo "$resDir\mipmap-$name\ic_launcher_foreground.png"
}

# --- Generate Splash Screens ---
# Port
Save-Splash 320 480 "$resDir\drawable-port-mdpi\splash.png"
Save-Splash 480 800 "$resDir\drawable-port-hdpi\splash.png"
Save-Splash 720 1280 "$resDir\drawable-port-xhdpi\splash.png"
Save-Splash 960 1600 "$resDir\drawable-port-xxhdpi\splash.png"
Save-Splash 1280 1920 "$resDir\drawable-port-xxxhdpi\splash.png"

# Land
Save-Splash 480 320 "$resDir\drawable-land-mdpi\splash.png"
Save-Splash 800 480 "$resDir\drawable-land-hdpi\splash.png"
Save-Splash 1280 720 "$resDir\drawable-land-xhdpi\splash.png"
Save-Splash 1600 960 "$resDir\drawable-land-xxhdpi\splash.png"
Save-Splash 1920 1280 "$resDir\drawable-land-xxxhdpi\splash.png"

# Default
Save-Splash 512 512 "$resDir\drawable\splash.png"

# Clean up
$srcBmp.Dispose()
$ms2.Close()
Write-Output "All assets generated successfully!"
