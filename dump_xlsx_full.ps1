Add-Type -AssemblyName System.IO.Compression.FileSystem

$tempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
[System.IO.Compression.ZipFile]::ExtractToDirectory('Indikator_Supervisi_Akademik.xlsx', $tempDir)

# 1. Read Workbook for sheet names
[xml]$wbXml = Get-Content (Join-Path $tempDir "xl\workbook.xml")
$sheets = @{}
foreach ($sheet in $wbXml.workbook.sheets.sheet) {
    $sheets[$sheet.sheetId] = $sheet.name
    Write-Output "Found Sheet: ID=$($sheet.sheetId), Name=$($sheet.name), r:id=$($sheet.id)"
}

# 2. Read Shared Strings
$sharedStrings = @()
$ssPath = Join-Path $tempDir "xl\sharedStrings.xml"
if (Test-Path $ssPath) {
    [xml]$ssXml = Get-Content $ssPath
    foreach ($si in $ssXml.sst.si) {
        if ($si.t) {
            $sharedStrings += $si.t
        } elseif ($si.r) {
            $t = ($si.r | ForEach-Object { $_.t }) -join ""
            $sharedStrings += $t
        } else {
            $sharedStrings += ""
        }
    }
}
Write-Output "Total Shared Strings: $($sharedStrings.Count)"

# 3. Read each sheet
Get-ChildItem (Join-Path $tempDir "xl\worksheets") -Filter "sheet*.xml" | ForEach-Object {
    Write-Output "`n=================== $($_.Name) ==================="
    [xml]$sheetXml = Get-Content $_.FullName
    $rows = $sheetXml.worksheet.sheetData.row
    foreach ($row in $rows) {
        $rowNum = $row.r
        $cells = @()
        foreach ($c in $row.c) {
            $val = ""
            if ($c.t -eq "s") {
                $idx = [int]$c.v
                $val = $sharedStrings[$idx]
            } elseif ($c.v) {
                $val = $c.v
            }
            $cells += "$($c.r): $val"
        }
        Write-Output "Row $rowNum | $($cells -join ' | ')"
    }
}

Remove-Item -Recurse -Force $tempDir
