$files = Get-ChildItem -Path "C:\Users\mathb\Downloads" -File
foreach ($f in $files) {
    if ($f.Name -match "RPP|Telaah|Instrumen|Observasi|Supervisi|42") {
        Write-Host "$($f.Name) | $($f.Length) bytes | $($f.LastWriteTime)"
    }
}
