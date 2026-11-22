"""Stage a signed Windows release for dl.trovebbs.com and GitHub block downloads."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tempfile

ROOT_URL = "https://dl.trovebbs.com/moligod-toolbox"
BLOCK_MAP = "windows-x64.blocks.json"


def block_map(data):
    blocks = []
    start = 0
    while start < len(data):
        limit = min(start + 262144, len(data))
        mark = data.find(b"\x6b\xb3", start + 16384, limit)
        end = mark + 2 if mark >= 0 else limit
        blocks.append([end - start, hashlib.sha256(data[start:end]).hexdigest()])
        start = end
    return {"schema": 1, "size": len(data), "blocks": blocks}


def check_inventory(directory, expected):
    def plain(path, kind):
        info = path.lstat()
        return kind(info.st_mode) and not (getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT)
    if not plain(directory, stat.S_ISDIR):
        raise ValueError("Release directory must be a regular directory")
    entries = list(directory.iterdir())
    if {entry.name for entry in entries} != expected or not all(plain(f, stat.S_ISREG) for f in entries):
        raise ValueError("Unexpected release inventory")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("webroot", type=Path)
    args = parser.parse_args()
    source = args.source
    manifest = json.loads((source / "latest.json").read_bytes())
    version = manifest["version"]
    if not re.fullmatch(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)", version):
        raise ValueError("Expected a stable release version")
    name = f"MoligodToolBox_{version}_x64-setup.exe"
    platforms = [v for k, v in manifest["platforms"].items() if k in ("windows-x86_64", "windows-x86_64-nsis")]
    if not platforms:
        raise ValueError("Missing Windows installer")
    for platform in platforms:
        if platform["url"] != f"https://github.com/moligod/MoligodToolBox/releases/download/v{version}/{name}":
            raise ValueError("Unexpected installer URL")
    product = args.webroot / "moligod-toolbox"
    releases = product / "releases"
    releases.mkdir(parents=True, exist_ok=True)
    destination = releases / f"v{version}"
    with tempfile.TemporaryDirectory(dir=args.webroot.parent) as temporary:
        stage = Path(temporary) / "release"
        stage.mkdir()
        for asset in (name, name + ".sig"):
            shutil.copyfile(source / asset, stage / asset)
        data = (stage / name).read_bytes()
        if not 0 < len(data) <= 512 * 1024 ** 2:
            raise ValueError("Installer exceeds updater limit")
        encoded = (stage / (name + ".sig")).read_text().strip()
        if any(platform["signature"] != encoded for platform in platforms):
            raise ValueError("Manifest signature differs from staged signature")
        verifier = Path(__file__).with_name("verify-release-signature.mjs")
        subprocess.run(["node", str(verifier), str(stage / name), version], check=True)
        (stage / BLOCK_MAP).write_text(json.dumps(block_map(data), separators=(",", ":")), encoding="utf-8")
        for platform in platforms:
            platform["url"] = f"{ROOT_URL}/releases/v{version}/{name}"
        contents = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode()
        (stage / "latest.json").write_bytes(contents)
        sums = "".join(f"{hashlib.sha256(f.read_bytes()).hexdigest()}  {f.name}\n" for f in sorted(stage.iterdir()))
        (stage / "SHA256SUMS.txt").write_bytes(sums.encode())
        if os.path.lexists(destination):
            check_inventory(destination, {name, name + ".sig", "latest.json", BLOCK_MAP, "SHA256SUMS.txt"})
            for f in stage.iterdir():
                if hashlib.sha256((destination / f.name).read_bytes()).digest() != hashlib.sha256(f.read_bytes()).digest():
                    raise ValueError(f"Published release differs: {f.name}")
        else:
            stage.rename(destination)
        current = product / "latest.json"
        if current.exists():
            prior = json.loads(current.read_bytes())["version"]
            if tuple(map(int, prior.split("."))) > tuple(map(int, version.split("."))):
                raise ValueError("Latest is already newer")
        pending = Path(temporary) / "latest.json"
        pending.write_bytes(contents)
        os.replace(pending, current)
    print(destination)


if __name__ == "__main__":
    main()
