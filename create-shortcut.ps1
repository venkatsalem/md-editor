$WshShell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "MD Editor.lnk"
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "D:\Venkat\Venkat-Browser\md-editor\node_modules\electron\dist\electron.exe"
$shortcut.Arguments = "."
$shortcut.WorkingDirectory = "D:\Venkat\Venkat-Browser\md-editor"
$shortcut.IconLocation = "D:\Venkat\Venkat-Browser\md-editor\icon.ico,0"
$shortcut.Description = "MD Editor - Markdown Editor"
$shortcut.Save()
Write-Host "Shortcut created at: $shortcutPath"
