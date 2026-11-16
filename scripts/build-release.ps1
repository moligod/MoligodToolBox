# Remap Rust diagnostic paths and scan all staged binaries before publication.
# Prepare offline OCR assets explicitly with scripts/prepare-ocr.ps1 first.
$ErrorActionPreference = 'Stop'
$releaseRoot = Split-Path -Parent $PSScriptRoot
$originalLocation = Get-Location
$savedFlags = $env:CARGO_ENCODED_RUSTFLAGS
$savedKey = $env:TAURI_SIGNING_PRIVATE_KEY
$savedPassword = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
try {
    Set-Location -LiteralPath $releaseRoot
    $releaseFlags = @(
        "--remap-path-prefix=${releaseRoot}=/src/moligod-toolbox"
        "--remap-path-prefix=$($env:USERPROFILE)=/_build"
    )
    $env:CARGO_ENCODED_RUSTFLAGS = $releaseFlags -join [char]31
    if (!$env:TAURI_SIGNING_PRIVATE_KEY) {
        $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -LiteralPath (Join-Path $releaseRoot '.local/updater/signing.key') -Raw
        $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
    }
    $releaseConfig = '{"build":{"beforeBuildCommand":"npm run modules:build && npm run build"},"bundle":{"createUpdaterArtifacts":true}}'
    npm run tauri -- build --ci --config $releaseConfig
    if ($LASTEXITCODE -ne 0) { throw "Signed release build failed ($LASTEXITCODE)" }
    node scripts/check-release-privacy.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Release privacy check failed; use a neutral build directory and Cargo cache' }
} finally {
    $env:CARGO_ENCODED_RUSTFLAGS = $savedFlags
    $env:TAURI_SIGNING_PRIVATE_KEY = $savedKey
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $savedPassword
    Set-Location -LiteralPath $originalLocation
}
