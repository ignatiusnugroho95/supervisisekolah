Add-Type -AssemblyName System.IO.Compression.FileSystem
$docxPath = 'C:\Users\mathb\Downloads\Instrumen_ Telaah RPP_edit1.docx'
$zip = [System.IO.Compression.ZipFile]::OpenRead($docxPath)
$entry = $zip.GetEntry('word/document.xml')
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$xmlStr = $reader.ReadToEnd()
$stream.Close()
$zip.Dispose()

[xml]$doc = $xmlStr
$ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
$ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')

$rows = $doc.SelectNodes('//w:tbl/w:tr', $ns)
$output = @()
foreach ($row in $rows) {
    $cells = $row.SelectNodes('.//w:tc', $ns)
    $cellTexts = @()
    foreach ($cell in $cells) {
        $text = ($cell.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join ''
        $cellTexts += $text.Trim()
    }
    $output += ($cellTexts -join ' | ')
}
$output | Out-File -FilePath 'c:\xampp\htdocs\ks.id\rpp_table_dump.txt' -Encoding utf8
Write-Host "Total rows dumped: $($output.Count)"
