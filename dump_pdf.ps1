$path = "C:\Users\mathb\Downloads\Prompt RPP Pembelajaran Mendalam.pdf"
$bytes = [System.IO.File]::ReadAllBytes($path)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
$clean = [regex]::Replace($text, "[^\x20-\x7E\r\n]", " ")
$clean | Out-File -FilePath "c:\xampp\htdocs\ks.id\pdf_dump.txt" -Encoding utf8
Write-Host "Dumped PDF bytes"
