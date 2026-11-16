# 第三方组件与许可

`MoligodToolBox` 的第一方代码与文档采用 GPL-3.0-only，并附有仅针对指定 GPU 运行库的链接例外。项目代码与分发的修改版仍须提供 GPL 对应源码。第三方组件适用各自的版权及许可条款。[限定链接例外](LICENSE-EXCEPTION)

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

经项目作者确认，DirectML、TensorRT for RTX、对应执行提供程序及必需 CUDA Runtime 采用 LICENSE-EXCEPTION 中的限定链接许可。供应商二进制保持其原有许可，不作为 GPL 代码提供；再分发这些运行库时仍须遵守各供应商条款并保留随包许可。

TensorRT for RTX 的供应商许可随运行库保存，适用的软件仅限 NVIDIA GPU 使用，并受供应商的分发与使用条件约束。[NVIDIA TensorRT for RTX 许可](https://docs.nvidia.com/deeplearning/tensorrt-rtx/latest/reference/sla.html)

## 包管理依赖

JavaScript 和 Rust 依赖由 `package-lock.json` 与 `Cargo.lock` 固定版本。安装包保留依赖声明汇总，包含缓存中固定版本依赖的许可原文、版权声明和来源；上游未在包中提供独立许可文件时保留发布元数据及源码地址。[依赖声明汇总](docs/licenses/DEPENDENCIES.txt)

更新依赖后可运行 `node scripts/generate-license-notices.mjs` 重新整理声明。补充的上游许可及对应源码版本记录于 `docs/licenses/upstream/`；构建工具依赖也可能包含在汇总中。
