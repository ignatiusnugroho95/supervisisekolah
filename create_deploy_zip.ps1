$zipName = "supervisi_deploy.zip"
if (Test-Path $zipName) { Remove-Item $zipName -Force }

$stagingDir = "temp_deploy_staging"
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $stagingDir | Out-Null

# Copy root essential files
Copy-Item ".htaccess" "$stagingDir\"
Copy-Item "index.html" "$stagingDir\"
Copy-Item "api.php" "$stagingDir\"
if (Test-Path "repair_online.php") { Copy-Item "repair_online.php" "$stagingDir\" }
if (Test-Path "supervisisekolah_id.sql") { Copy-Item "supervisisekolah_id.sql" "$stagingDir\" }
if (Test-Path "unzip.php") { Copy-Item "unzip.php" "$stagingDir\" }

# Copy essential directories
$folders = @('admin', 'config', 'dashboard', 'data', 'evaluasi', 'guru', 'js', 'karyawan', 'observasi', 'pengaturan', 'supervisi')
foreach ($f in $folders) {
    if (Test-Path $f) {
        Copy-Item -Path $f -Destination $stagingDir -Recurse
    }
}

# Remove heavy/sensitive local dev files from data directory
Get-ChildItem -Path "$stagingDir" -Include *.sqlite,*.sqlite-shm,*.sqlite-wal -Recurse | Remove-Item -Force -ErrorAction SilentlyContinue

Add-Type -AssemblyName System.IO.Compression.FileSystem

# Create zip package using .NET ZipFile
[System.IO.Compression.ZipFile]::CreateFromDirectory((Resolve-Path $stagingDir).Path, (Join-Path (Get-Location).Path $zipName))
Remove-Item $stagingDir -Recurse -Force -ErrorAction SilentlyContinue

$item = Get-Item $zipName
$sizeMb = [math]::Round($item.Length / 1MB, 2)
Write-Output "Zip created: $zipName ($sizeMb MB)"
