Add-Type -AssemblyName System.IO.Compression.FileSystem

function Dump-Docx($path, $outFile) {
    if (!(Test-Path $path)) { return }
    $zip = [System.IO.Compression.ZipFile]::OpenRead($path)
    $entry = $zip.GetEntry('word/document.xml')
    $stream = $entry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $xmlStr = $reader.ReadToEnd()
    $stream.Close()
    $zip.Dispose()

    [xml]$doc = $xmlStr
    $ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
    $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')

    $tables = $doc.SelectNodes('//w:tbl', $ns)
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine("=== FILE: $path ===")
    [void]$sb.AppendLine("Total Tables: $($tables.Count)")

    $tIndex = 0
    foreach ($tbl in $tables) {
        $tIndex++
        [void]$sb.AppendLine("--- TABLE $tIndex ---")
        $rows = $tbl.SelectNodes('.//w:tr', $ns)
        foreach ($row in $rows) {
            $cells = $row.SelectNodes('.//w:tc', $ns)
            $cellTexts = @()
            foreach ($cell in $cells) {
                $text = ($cell.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join ''
                $cellTexts += $text.Trim()
            }
            [void]$sb.AppendLine(($cellTexts -join ' | '))
        }
    }

    # Also dump all paragraphs outside tables or headers
    [void]$sb.AppendLine("=== PARAGRAPHS ===")
    $paras = $doc.SelectNodes('//w:body/w:p', $ns)
    foreach ($p in $paras) {
        $text = ($p.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join ''
        if ($text.Trim()) {
            [void]$sb.AppendLine($text.Trim())
        }
    }

    $sb.ToString() | Out-File -FilePath $outFile -Encoding utf8
    Write-Host "Dumped $path to $outFile"
}

Dump-Docx 'C:\Users\mathb\Downloads\Instrumen_ Telaah RPP_edit1.docx' 'c:\xampp\htdocs\ks.id\dump_telaah_rpp_edit1.txt'
Dump-Docx 'C:\Users\mathb\Downloads\Instrumen Penilaian Perangkat Pembelajaran (RPP atau Modul ajar) UKPPG 2025.docx' 'c:\xampp\htdocs\ks.id\dump_ukppg.txt'
