# Explicit build-time native asset preparation. Never run by the application.
# Requires PowerShell 7; no Python, pip, PyInstaller, OpenCV or Paddle runtime.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$download = Join-Path $root 'target/ocr-native-download'
$output = Join-Path $root 'target/ocr-native-runtime'
New-Item -ItemType Directory -Force $download,$output | Out-Null
function Get-VerifiedAsset([string]$Name,[string]$Url,[string]$Hash) {
    $archive = Join-Path $download ($Name + '.zip')
    if (!(Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive).Hash -ne $Hash) {
        Write-Host "Downloading $Name"
        Invoke-WebRequest $Url -OutFile $archive -NoProxy
    }
    if ((Get-FileHash -LiteralPath $archive).Hash -ne $Hash) { throw "Hash mismatch: $Name" }
    $expanded = Join-Path $download $Name
    Expand-Archive -LiteralPath $archive -DestinationPath $expanded -Force
    return $expanded
}
$dmlOrt = Get-VerifiedAsset 'ort-dml' 'https://api.nuget.org/v3-flatcontainer/microsoft.ml.onnxruntime.directml/1.24.4/microsoft.ml.onnxruntime.directml.1.24.4.nupkg' '57E9F11B73437BEF7A309496135D4C1F96B1A8E9DDBA60013FA27BFC1D788681'
$cpuOrt = Get-VerifiedAsset 'ort' 'https://api.nuget.org/v3-flatcontainer/microsoft.ml.onnxruntime/1.26.0/microsoft.ml.onnxruntime.1.26.0.nupkg' '50CC3772668F04B8373AD65A36793F94699BC4E818F6E691FC68F1578C38CE42'
$dml = Get-VerifiedAsset 'dml' 'https://api.nuget.org/v3-flatcontainer/microsoft.ai.directml/1.15.4/microsoft.ai.directml.1.15.4.nupkg' '4E7CB7DDCE8CF837A7A75DC029209B520CA0101470FCDF275C1F49736A3615B9'
$rtx = Get-VerifiedAsset 'rtx' 'https://github.com/NVIDIA/TensorRT-RTX-EP-ABI/releases/download/v0.5.0/TensorRT-RTX-EP-ABI-v0.5.0-cu13.zip' '41469E0B21CABF997CBEE3638D9AA4400AE19601667E18CCF6628A960FB0ACA3'
# NVIDIA native redistribution archive: only cudart and its license are shipped.
$cuda = Get-VerifiedAsset 'cuda132' 'https://developer.download.nvidia.com/compute/cuda/redist/cuda_cudart/windows-x86_64/cuda_cudart-windows-x86_64-13.2.51-archive.zip' '906B430B53E6396F7CBAA6874FBE7F9307A184E830B119A4AD3F58DC6E0165C6'
$directml = Join-Path $output 'directml'
$nvidia = Join-Path $output 'nvidia'
$licenses = Join-Path $output 'licenses'
New-Item -ItemType Directory -Force $directml,$nvidia,$licenses | Out-Null
foreach ($name in @('onnxruntime.dll','onnxruntime_providers_shared.dll')) {
    Copy-Item -LiteralPath (Join-Path $dmlOrt "runtimes/win-x64/native/$name") -Destination $directml
    Copy-Item -LiteralPath (Join-Path $cpuOrt "runtimes/win-x64/native/$name") -Destination $nvidia
}
Copy-Item -LiteralPath (Join-Path $dml 'bin/x64-win/DirectML.dll') -Destination $directml
# The pinned small/tiny models use the RTX core/parser/EP, not the optional plugin library.
# Keep an explicit list so vendor archive additions cannot silently enlarge the package.
$rtxRuntime = Join-Path $rtx 'TensorRT-RTX-EP-ABI-v0.5.0-cu13'
foreach ($name in @('onnxruntime_providers_nv_tensorrt_rtx.dll','tensorrt_rtx_1_7.dll','tensorrt_onnxparser_rtx_1_7.dll')) {
    Copy-Item -LiteralPath (Join-Path $rtxRuntime $name) -Destination $nvidia
}
$unusedPlugin = Join-Path $nvidia 'tensorrt_plugins.dll'
if (Test-Path -LiteralPath $unusedPlugin) { Remove-Item -LiteralPath $unusedPlugin }
Copy-Item -LiteralPath (Join-Path $cuda 'cuda_cudart-windows-x86_64-13.2.51-archive/bin/x64/cudart64_13.dll') -Destination $nvidia
foreach ($entry in @(@('ort',$cpuOrt),@('ort-dml',$dmlOrt),@('dml',$dml),@('rtx',$rtx),@('cuda',$cuda))) {
    $i=0
    Get-ChildItem -LiteralPath $entry[1] -Recurse -File | Where-Object { $_.Name -match '(?i)license|acknowledg|thirdpartynotice' } | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $licenses ($entry[0] + '-' + $i + '-' + $_.Name)); $i++
    }
}
$models = Get-Content -LiteralPath (Join-Path $root 'modules/ocr/models.lock.json') -Raw | ConvertFrom-Json -AsHashtable
foreach ($name in $models.Keys) {
    $model=$models[$name]; $parts=$name.Split('_'); $tier=$parts[1]; $part=$parts[2]
    $dest=Join-Path $output "models/$tier"
    New-Item -ItemType Directory -Force $dest | Out-Null
    $file=$model.files | Where-Object rfilename -EQ 'inference.onnx'
    $cached=Join-Path $root "target/ocr-download/$name-inference.onnx"
    if (!(Test-Path -LiteralPath $cached) -or (Get-FileHash -LiteralPath $cached).Hash -ne $file.lfs.sha256) {
        New-Item -ItemType Directory -Force (Split-Path -Parent $cached) | Out-Null
        Invoke-WebRequest "https://huggingface.co/PaddlePaddle/$name/resolve/$($model.revision)/inference.onnx" -OutFile $cached -NoProxy
    }
    if ((Get-FileHash -LiteralPath $cached).Hash -ne $file.lfs.sha256) { throw "Model hash mismatch: $name" }
    Copy-Item -LiteralPath $cached -Destination (Join-Path $dest "$part.onnx")
    Copy-Item -LiteralPath (Join-Path $root "modules/ocr/config/$tier.json") -Destination (Join-Path $dest 'config.json')
}
Copy-Item -LiteralPath (Join-Path $root 'modules/ocr/LICENSE') -Destination (Join-Path $licenses 'PaddleOCR-LICENSE.txt')
Copy-Item -LiteralPath (Join-Path $root 'modules/ocr/README.md') -Destination $output
# Inventory validates every shipped native asset in the module build.
$inventory=@{}
Get-ChildItem -LiteralPath $output -Recurse -File | Where-Object { $_.Name -notin @('assets.json','moligod-ocr.exe') } | ForEach-Object {
    $relative=[IO.Path]::GetRelativePath($output,$_.FullName).Replace('\','/')
    $inventory[$relative]=(Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant()
}
$inventory | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'assets.json') -Encoding utf8
Write-Host "Native OCR assets ready: $output"
