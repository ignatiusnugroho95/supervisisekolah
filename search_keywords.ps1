$paths = @("C:\Users\mathb\Downloads", "C:\Users\mathb\Documents", "C:\Users\mathb\Desktop", "c:\xampp\htdocs")
$results = @()
foreach ($p in $paths) {
    if (Test-Path $p) {
        $files = Get-ChildItem -Path $p -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in @('.docx','.xlsx','.pdf','.txt','.json','.html','.md','.tsx','.ts','.js') }
        foreach ($f in $files) {
            if ($f.Name -like "*node_modules*" -or $f.FullName -like "*node_modules*" -or $f.FullName -like "*\.git\*") { continue }
            $match = Select-String -Path $f.FullName -Pattern "42", "Telaah RPP", "Pembelajaran Mendalam", "Instrumen Perencanaan" -SimpleMatch -Quiet -ErrorAction SilentlyContinue
            if ($match) {
                $results += $f.FullName
            }
        }
    }
}
$results | Out-File -FilePath 'c:\xampp\htdocs\ks.id\search_results.txt' -Encoding utf8
Write-Host "Found $($results.Count) files"
