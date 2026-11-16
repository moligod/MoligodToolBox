# 第三方组件与许可

`MoligodToolBox` 的第一方代码与文档采用 GPL-3.0-only。第三方组件适用各自的版权及许可条款。

## 随源码保存的组件

| 组件                | 用途                         | 许可文件                             |
| ------------------- | ---------------------------- | ------------------------------------ |
| Lucide              | 工具入口静态图标             | `public/licenses/Lucide-LICENSE.txt` |
| Phosphor Icons      | 自动化界面图标               | `public/icons/LICENSE`               |
| Blockly             | 可视化自动化编辑器与离线素材 | `public/blockly/LICENSE`             |
| PaddleOCR / PaddleX | OCR 配置、字典与算法参考     | `modules/ocr/LICENSE`                |

## 历史 UI 参考

早期分段按钮曾适配 Rare UI GooeyNav，revision `21554cba3ac751c1f9c06869eadb9d44a0af7225`，作者 Swami Malode。该组件附带 Commons Clause 及 Attribution 条款。GPL 版本使用本项目独立编写的 `src/components/segmented-controls.css`，历史来源与原许可保存在组件文档和 `public/licenses/Rare-UI-LICENSE.txt`。[Rare UI](https://rareui.com) · [组件记录](docs/rare-ui.md)

Lucide 的 ISC 及继承 MIT 声明、Phosphor Icons 的 MIT 声明、Blockly 和 PaddleOCR / PaddleX 的 Apache-2.0 声明均随对应文件保留。

## 构建时下载的 OCR 资源

OCR 准备脚本显式下载 ONNX Runtime、DirectML、TensorRT RTX、CUDA Runtime 和 PaddlePaddle 模型，核对固定 SHA-256，并将供应商许可复制至运行时的 `licenses/` 目录。模型来源与 revision 记录在 `modules/ocr/models.lock.json`。

分发构建产物时需一并保留模块目录中的供应商许可，并核对各资源的分发条件。资源清单和构建步骤见 OCR 文档。[OCR 构建说明](modules/ocr/README.md)

完整二进制分发前，需核对 TensorRT RTX、CUDA Runtime 等供应商资源与 GPL 程序组合的许可兼容性，或确定可兼容的分发方案。当前验证覆盖源码许可更新与现有构建检查。

## 包管理依赖

JavaScript 和 Rust 依赖由 `package-lock.json` 与 `Cargo.lock` 固定版本。依赖自身的许可随包管理器下载的源码提供，发布构建产物时应按实际使用的依赖保留所需声明。
