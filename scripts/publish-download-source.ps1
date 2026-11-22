# Publishes one already signed local release. Uses the operator's SSH configuration.
param(
    [Parameter(Mandatory)][string]$ReleaseDirectory,
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9_.@-]*$')][string]$SshHost,
    [Parameter(Mandatory)][ValidatePattern('^(/[a-zA-Z0-9_-]+){2,}$')][string]$RemoteWebRoot
)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$site = Join-Path $project 'target/download-site'
$version = (Get-Content -LiteralPath (Join-Path $ReleaseDirectory 'latest.json') -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Expected a stable release' }
python (Join-Path $PSScriptRoot 'stage-download-source.py') $ReleaseDirectory $site
if ($LASTEXITCODE -ne 0) { throw 'Failed to stage release' }
$parent = $RemoteWebRoot.Substring(0, $RemoteWebRoot.LastIndexOf('/'))
$stage = (ssh $SshHost "mktemp -d '$parent/dl-stage-XXXXXXXX'").Trim()
if ($LASTEXITCODE -ne 0 -or $stage -cnotmatch ('^' + [regex]::Escape($parent) + '/dl-stage-[a-zA-Z0-9]+$')) { throw 'Failed to create upload staging directory' }
$local = Join-Path $site "moligod-toolbox/releases/v$version"
$installer = "MoligodToolBox_${version}_x64-setup.exe"
$assets = @($installer, "$installer.sig", 'latest.json', 'windows-x64.blocks.json', 'SHA256SUMS.txt')
$paths = @($assets | ForEach-Object { Join-Path $local $_ })
ssh $SshHost "mkdir '$stage/v$version'"
if ($LASTEXITCODE -ne 0) { throw 'Failed to create release directory' }
scp @paths "${SshHost}:${stage}/v$version/"
if ($LASTEXITCODE -ne 0) { throw "Upload incomplete in $stage" }
$promote = @'
set -eu
stage=$1; tag=$2
product=$3/moligod-toolbox
mkdir -p "$product/releases"
exec 9>"$(dirname "$stage")/.moligod-download-publish.lock"
flock -x 9
# Validate the incoming directory and any existing public version before promotion.
python3 - "$tag" "$stage/$tag" "$product/releases/$tag" <<'PY'
import os, sys
from pathlib import Path
name = f"MoligodToolBox_{sys.argv[1][1:]}_x64-setup.exe"
expected = {name, name + ".sig", "latest.json", "SHA256SUMS.txt", "windows-x64.blocks.json"}
for directory in map(Path, sys.argv[2:]):
    if not os.path.lexists(directory):
        continue
    if directory.is_symlink() or not directory.is_dir():
        sys.exit("Unexpected release directory")
    entries = list(directory.iterdir())
    if {p.name for p in entries} != expected or any(p.is_symlink() or not p.is_file() for p in entries):
        sys.exit("Unexpected release inventory")
PY
cd "$stage/$tag"
sha256sum -c SHA256SUMS.txt
if [ -e "$product/releases/$tag" ]; then
    cmp SHA256SUMS.txt "$product/releases/$tag/SHA256SUMS.txt"
    (cd "$product/releases/$tag" && sha256sum -c SHA256SUMS.txt)
else
    mv "$stage/$tag" "$product/releases/$tag"
fi
python3 - "$product" "$tag" "$stage" <<'PY'
import json, os, pathlib, sys
product, tag, stage = sys.argv[1:]
current = pathlib.Path(product) / "latest.json"
version = lambda text: tuple(int(n) for n in text.split("."))
if current.exists() and version(json.loads(current.read_bytes())["version"]) > version(tag[1:]):
    sys.exit("Refusing to replace latest with an older version")
pending = pathlib.Path(stage) / "latest.json"
pending.write_bytes((pathlib.Path(product) / "releases" / tag / "latest.json").read_bytes())
os.replace(pending, current)
PY
if [ -d "$stage/$tag" ]; then
    for name in "MoligodToolBox_${tag#v}_x64-setup.exe" "MoligodToolBox_${tag#v}_x64-setup.exe.sig" latest.json SHA256SUMS.txt windows-x64.blocks.json; do
        unlink "$stage/$tag/$name"
    done
    rmdir "$stage/$tag"
fi
rmdir "$stage"
'@
$promote.Replace("`r", '') | ssh $SshHost "tr -d '\r' | sh -se -- '$stage' 'v$version' '$RemoteWebRoot'"
if ($LASTEXITCODE -ne 0) { throw "Promotion failed; inspect $stage" }
Write-Output "https://dl.trovebbs.com/moligod-toolbox/releases/v$version/"
