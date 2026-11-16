# 官方组件

客户端“获取官方组件”读取本目录中的 `index.json`。当前内置一个等待1秒的基础示例。

添加组件时，先在自动化助手中导出组件动作代码，将完整 JSON 保存为本目录下的 `<id>.json`。在 `index.json` 中登记相同 id、名称和说明。id 使用小写英文字母、数字和连字符，最长64字节。目录 schemaVersion 为1，最多100项。

每个动作代码文件使用现有组件库 schemaVersion 1，最多1MiB。导入后自动分配本机组件标识；用户确认运行任务后才执行动作。涉及图片模板的组件需要另行提供模板资源与准备说明。

客户端固定从 `moligod/MoligodToolBox` 的 `main` 分支读取。提交目录和组件文件后，新组件可在客户端重新获取。客户端安装包升级通过 GitHub Releases 分发，维护方式见发布文档。[发布与更新](../docs/github-distribution.md)
