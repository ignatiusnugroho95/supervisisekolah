Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::OpenRead('Indikator_Supervisi_Akademik.xlsx')

Write-Output "=== ENTRIES ==="
foreach ($entry in $zip.Entries) {
    if ($entry.FullName -match 'sheet|workbook|sharedStrings') {
        Write-Output $entry.FullName
    }
}
$zip.Dispose()
