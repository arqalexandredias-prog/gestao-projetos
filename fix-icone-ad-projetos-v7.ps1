# fix-icone-ad-projetos-v7.ps1
# Ícone AD centralizado matematicamente, sem borda clara externa.
# Marcador: AD_PROJETOS_ICON_V7

$ErrorActionPreference = "Stop"

Write-Host "Gerando ícone AD Projetos V7 centralizado..." -ForegroundColor Cyan

Add-Type -AssemblyName System.Drawing

New-Item -ItemType Directory -Force -Path ".\public\icons" | Out-Null

function New-ADProjetosIcon {
  param(
    [int]$Size,
    [string]$Path
  )

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)

  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $brown = [System.Drawing.Color]::FromArgb(255, 45, 29, 23)
  $cream = [System.Drawing.Color]::FromArgb(255, 255, 248, 238)
  $softCream = [System.Drawing.Color]::FromArgb(255, 220, 195, 179)
  $terracotta = [System.Drawing.Color]::FromArgb(255, 190, 114, 84)

  # Fundo 100% marrom para eliminar halo/borda clara no Android.
  $g.Clear($brown)

  # Detalhe superior direito, dentro da área segura.
  $dotSize = [int]($Size * 0.145)
  $dotX = [int]($Size * 0.735)
  $dotY = [int]($Size * 0.125)
  $dotRadius = [int]($Size * 0.04)

  $dotPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $dotPath.AddArc($dotX, $dotY, $dotRadius * 2, $dotRadius * 2, 180, 90)
  $dotPath.AddArc($dotX + $dotSize - ($dotRadius * 2), $dotY, $dotRadius * 2, $dotRadius * 2, 270, 90)
  $dotPath.AddArc($dotX + $dotSize - ($dotRadius * 2), $dotY + $dotSize - ($dotRadius * 2), $dotRadius * 2, $dotRadius * 2, 0, 90)
  $dotPath.AddArc($dotX, $dotY + $dotSize - ($dotRadius * 2), $dotRadius * 2, $dotRadius * 2, 90, 90)
  $dotPath.CloseFigure()

  $terracottaBrush = New-Object System.Drawing.SolidBrush $terracotta
  $g.FillPath($terracottaBrush, $dotPath)

  # Fontes.
  $fontADSize = [float]($Size * 0.335)
  $fontSubSize = [float]($Size * 0.055)

  $fontAD = New-Object System.Drawing.Font "Georgia", $fontADSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fontSub = New-Object System.Drawing.Font "Arial", $fontSubSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)

  $formatCenter = New-Object System.Drawing.StringFormat
  $formatCenter.Alignment = [System.Drawing.StringAlignment]::Center
  $formatCenter.LineAlignment = [System.Drawing.StringAlignment]::Center

  # AD centralizado de forma matemática.
  # Pequeno ajuste óptico para a esquerda porque o D pesa mais visualmente.
  $adRect = New-Object System.Drawing.RectangleF(
    [float](-$Size * 0.012),
    [float]($Size * 0.235),
    [float]$Size,
    [float]($Size * 0.42)
  )

  $creamBrush = New-Object System.Drawing.SolidBrush $cream
  $g.DrawString("AD", $fontAD, $creamBrush, $adRect, $formatCenter)

  # PROJETOS centralizado.
  $subRect = New-Object System.Drawing.RectangleF(
    [float]0,
    [float]($Size * 0.665),
    [float]$Size,
    [float]($Size * 0.10)
  )

  $softBrush = New-Object System.Drawing.SolidBrush $softCream
  $g.DrawString("PROJETOS", $fontSub, $softBrush, $subRect, $formatCenter)

  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose()
  $bmp.Dispose()
}

$sizes = @(48, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512)

foreach ($size in $sizes) {
  New-ADProjetosIcon -Size $size -Path ".\public\icons\ad-projetos-$size-v7.png"
}

Copy-Item ".\public\icons\ad-projetos-180-v7.png" ".\public\apple-touch-icon.png" -Force
Copy-Item ".\public\icons\ad-projetos-192-v7.png" ".\public\favicon.png" -Force
Copy-Item ".\public\icons\ad-projetos-192-v7.png" ".\public\logo192.png" -Force
Copy-Item ".\public\icons\ad-projetos-512-v7.png" ".\public\logo512.png" -Force

# favicon.ico
$iconBmp = New-Object System.Drawing.Bitmap ".\public\icons\ad-projetos-256-v7.png"
$iconHandle = $iconBmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)
$stream = New-Object System.IO.FileStream ".\public\favicon.ico", ([System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Close()
$icon.Dispose()
$iconBmp.Dispose()

# SVG fallback sem borda clara
@'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2d1d17"/>
  <rect x="376" y="64" width="74" height="74" rx="22" fill="#be7254"/>
  <text x="250" y="284" text-anchor="middle" font-family="Georgia,serif" font-size="172" font-weight="700" fill="#fff8ee">AD</text>
  <text x="256" y="370" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" font-weight="800" letter-spacing="5" fill="#dcc3b3">PROJETOS</text>
</svg>
'@ | Set-Content -Path ".\public\vite.svg" -Encoding UTF8

Copy-Item ".\public\vite.svg" ".\public\favicon.svg" -Force

# Manifest sem acento para evitar GestÃ£o
@'
{
  "id": "/ad-projetos-v7",
  "name": "Alexandre Dias | Gestao de Projetos",
  "short_name": "AD Projetos",
  "description": "Sistema premium para gestao de projetos de interiores.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#2d1d17",
  "theme_color": "#2d1d17",
  "lang": "pt-BR",
  "categories": ["business", "productivity"],
  "icons": [
    {
      "src": "/icons/ad-projetos-192-v7.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/ad-projetos-512-v7.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/ad-projetos-192-v7.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/ad-projetos-512-v7.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
'@ | Set-Content -Path ".\public\manifest.webmanifest" -Encoding UTF8

Copy-Item ".\public\manifest.webmanifest" ".\public\manifest.json" -Force

# Garante head correto
$indexPath = ".\index.html"
$index = Get-Content $indexPath -Raw

$index = $index -replace '<link rel="manifest"[^>]*>\s*', ''
$index = $index -replace '<link rel="icon"[^>]*>\s*', ''
$index = $index -replace '<link rel="apple-touch-icon"[^>]*>\s*', ''
$index = $index -replace '<meta name="theme-color"[^>]*>\s*', ''
$index = $index -replace '<meta name="application-name"[^>]*>\s*', ''
$index = $index -replace '<meta name="apple-mobile-web-app-title"[^>]*>\s*', ''

$headTags = @'
    <!-- AD_PROJETOS_ICON_V7 -->
    <link rel="manifest" href="/manifest.webmanifest?v=7" />
    <link rel="icon" href="/favicon.ico?v=7" sizes="any" />
    <link rel="icon" type="image/png" href="/favicon.png?v=7" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=7" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=7" />
    <meta name="theme-color" content="#2d1d17" />
    <meta name="application-name" content="AD Projetos" />
    <meta name="apple-mobile-web-app-title" content="AD Projetos" />

'@

$index = $index -replace '<!-- AD_PROJETOS_ICON_V[0-9] -->[\s\S]*?<meta name="apple-mobile-web-app-title" content="[^"]*" />\s*', ''
$index = $index -replace '<head>', "<head>`n$headTags"

Set-Content -Path $indexPath -Value $index -Encoding UTF8

Write-Host ""
Write-Host "Ícone V7 gerado: fundo 100% marrom, sem borda clara e AD centralizado." -ForegroundColor Green
Write-Host "Agora rode: git add -A; git commit -m 'Ajustar icone AD centralizado'; git push origin main" -ForegroundColor Cyan
