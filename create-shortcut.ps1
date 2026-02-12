# Creates a desktop shortcut for MD Editor.
# Works from any clone location — all paths are derived from the script's directory.

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$electronExe = Join-Path $projectDir "node_modules\electron\dist\electron.exe"
$iconFile = Join-Path $projectDir "icon.ico"

if (-not (Test-Path $electronExe)) {
    Write-Host "Error: electron not found. Run 'npm install' first." -ForegroundColor Red
    exit 1
}

$WshShell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "MD Editor.lnk"

$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $electronExe
$shortcut.Arguments = "."
$shortcut.WorkingDirectory = $projectDir
$shortcut.Description = "MD Editor - Markdown Editor"

if (Test-Path $iconFile) {
    $shortcut.IconLocation = "$iconFile,0"
}

$shortcut.Save()
Write-Host "Shortcut created at: $shortcutPath"
