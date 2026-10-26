$files = Get-ChildItem -Path "C:\Users\mathb\Desktop", "C:\Users\mathb\Documents" -Recurse -File -ErrorAction SilentlyContinue
foreach ($f in $files) {
    if ($f.Name -match "RPP|Telaah|Instrumen|Pembelajaran") {
        Write-Host "$($f.FullName) | $($f.Length) bytes"
    }
}
