# Native Rust PP-OCRv6

`moligod-ocr.exe` is compiled by Cargo. Image resize/normalization, DB text boxes,
perspective crops and CTC decoding are Rust (`image` / `imageproc`). Inference uses
the native ONNX Runtime C API through `ort`; no Python, NumPy, OpenCV, Paddle or
PyInstaller is used in building or running this module.

The task-list header saves one global model/device choice in `ocr-settings.json`:

| UI       | Device | Backend                                                |
| -------- | ------ | ------------------------------------------------------ |
| CPU 识别 | cpu    | CPUExecutionProvider                                   |
| 显卡识别 | amd    | DmlExecutionProvider; compatible AMD, NVIDIA or Intel hardware |
| N卡专用（30系+） | nvidia | NvTensorRTRTXExecutionProvider; RTX 30-series or later |

Both small and tiny official PP-OCRv6 detection/recognition models are retained.
Missing hardware or native resources fail explicitly. GPU mode never retries a
failed session as CPU (individual unsupported operators can still be CPU nodes).
The DirectML setting keeps the historical `amd` value for storage/IPC compatibility,
but is no longer restricted by vendor. It prefers the Windows high-performance GPU,
maps its LUID back to the DXGI adapter index, and excludes software adapters.
If GPU preference is unavailable, it uses the first hardware adapter. Incompatible
DirectML devices report initialization errors rather than silently switching to CPU.
Legacy `gpu` settings read as `amd`; old action-level `ocrModel` fields remain
readable but execution uses the global snapshot. Default is CPU + small.

## Build (PowerShell 7)

```powershell
./scripts/prepare-ocr.ps1
npm run modules:dev
cargo test -p moligod-ocr --locked
cargo test -p moligod-automation --lib --locked offline_models -- --ignored --nocapture
```

Preparation is an explicit build-only download step, with pinned SHA-256 for all
archives and models. It extracts only native libraries/licenses; no .NET managed
assemblies from NuGet are shipped. Model dictionaries and DB configuration are
vendored in `config/`, extracted from the exact official revisions in
`models.lock.json`. Build scripts verify the prepared asset inventory.

Runtime versions: CPU/DML ORT 1.24.4 + DirectML 1.15.4; N-card ORT 1.26.0 +
TensorRT RTX EP 0.5.0 / TensorRT RTX 1.7 + CUDA Runtime 13.2.51. Separate ORT DLL
directories avoid incompatible provider builds. Each Rust OCR process loads only
the selected runtime. NVIDIA driver and Windows VC++ runtime must be compatible;
users need no CUDA Toolkit, Python installation or network access.

The RTX archive contributes only `onnxruntime_providers_nv_tensorrt_rtx.dll`,
`tensorrt_rtx_1_7.dll` and `tensorrt_onnxparser_rtx_1_7.dll`. The optional
`tensorrt_plugins.dll` is excluded: the pinned small/tiny models were verified
without it. Preparation and module staging remove older copies, and the build
rejects its reintroduction. Recheck this requirement when changing models or RTX
versions; keep the separate ONNX Runtime and CUDA Runtime DLLs and vendor notices.

The automation engine starts this Rust subprocess only at first OCR. It retains
one model/device pair and kills/waits it on cancellation, timeout or disposal.
Initialization/inference bounds are 10/15 seconds for CPU/DML and 120/120 seconds
for RTX (first-use compilation); the parent checks cancellation every 20ms.
RTX disk caching is disabled pending correctness verification; sessions are reused in process. No OCR startup work, polling, automatic downloads or
telemetry. Inputs are capped at 8192 pixels per side/16Mi pixels and output at
4096 characters. Still-image input only.

The internal `dml-test` CLI device is a diagnostic for exercising DirectML on
adapter 0 on non-AMD test machines; it is not accepted as a saved UI setting.

## Sources and licenses

- https://www.paddleocr.ai/main/version3.x/pipeline_usage/OCR.html
- Official PaddlePaddle model repositories/revisions: `models.lock.json`
- DB/CTC algorithm: PaddleX 3.7.2 (Apache-2.0, retained `LICENSE`)
- https://nvidia.github.io/TensorRT-RTX-EP-ABI/integration-guide.html
- https://onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html
- Vendor licenses/notices are included under runtime `licenses/`.

RTX compatibility: the pinned EP produced incorrect results with dynamic ONNX
input dimensions on the RTX 5080 regression fixture. The N-card path therefore
sets static batch=1, detector=960x960 and recognizer=48x3200. Each tile is
padded with normalized zeros. Recognition retains the existing 3200-pixel
maximum and pads shorter lines. CPU/DML retain their dynamic dimensions. Disk
cache and CUDA graph capture stay disabled. First-use compilation and larger
padded tensors are a latency/memory tradeoff; do not claim a GPU speedup without
measuring the actual workload.

OCR uses the dimensions of the captured region. Regions up to 1920 pixels on the
long side use one detection pass at a maximum long side of 960. Larger regions
use a detection map with a long side of 1696–1856 pixels. Up to four overlapping
tiles contribute scores to that map. Text boxes are extracted once, then each
line is read from the original capture. This increases detection work for large
regions while preserving more detail in small text.
