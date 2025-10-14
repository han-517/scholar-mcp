# Scholar MCP

基于 [Cool Papers](https://papers.cool) 的 Model Context Protocol (MCP) 服务器，统一封装 arXiv 预印本和已发表 venue 论文的搜索、PDF 下载与 Kimi FAQ 分析能力，并在工具返回结果中自动隐藏站点的内部统计字段。

## 核心特性
- 🔍 **统一检索**：通过网页解析直接访问 Cool Papers 的 `arxiv` 与 `venue` 列表，支持 `show`、`skip`、`sort` 参数。
- 📥 **安全下载**：自动提取页面中的 PDF 链接并保存到指定目录，避免手动查找 URL。
- 🤖 **Kimi FAQ**：抓取 Kimi 生成的问答内容，快速了解论文重点。
- 🧰 **MCP 原生**：所有功能以工具形式暴露，可在 Claude Code 等客户端按需组合调用。

## 快速开始
```bash
npm install           # 安装依赖
npm run build         # 生成 dist/
npm run dev           # TSX 热加载开发
npm run test:cool     # 运行 Cool Papers 冒烟测试
```

### 在 Claude Code 中注册
```bash
claude mcp add scholar-mcp node /absolute/path/to/scholar-mcp/dist/index.js
```
或在配置文件中加入：
```json
{
  "mcpServers": {
    "scholar-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/scholar-mcp/dist/index.js"],
      "description": "Cool Papers search, download, and Kimi FAQ"
    }
  }
}
```

## MCP 工具
### `search_papers`
- **参数**：`source` (`arxiv`|`venue`, 默认 `arxiv`)、`query` (必填)、`show`、`skip`、`sort`。
- **输出**：`total` 与若干论文条目（字段：`id`、`title`、`externalUrl`、`pdfUrl`、`authors`、`abstract`、`subjects`、`publishTime`、`relatedKeywords`）。内部统计字段会自动剔除。
- **示例**：
```json
{
  "source": "venue",
  "query": "swe",
  "show": 5,
  "sort": 1
}
```

### `download_single_paper`
- **参数**：`source`、`paperId`、`downloadFolder`，可选 `filename`。
- **输出**：
  ```json
  {
    "mode": "single",
    "download": {
      "pdfUrl": "…",
      "filePath": "…",
      "fileSize": 123456,
      "paper": { "id": "…", "title": "…" }
    }
  }
  ```
- **注意**：`filename` 仅用于指定自定义文件名；默认使用 `<paperId>.pdf`。

### `download_batch_papers`
- **参数**：`source`、`query`、`downloadFolder`，可选 `show`、`skip`、`sort`。
- **输出**：
  ```json
  {
    "mode": "batch",
    "search": {
      "source": "arxiv",
      "query": "swe",
      "total": 256,
      "papers": [ { "id": "…" } ],
      "params": { "show": 5, "sort": 0 }
    },
    "successes": [ { "paper": { "id": "…" }, "filePath": "…" } ],
    "failures": [ { "paper": { "id": "…" }, "error": "…" } ]
  }
  ```
- **注意**：批量下载会逐篇尝试保存 PDF，默认使用 `<paperId>.pdf` 文件名。

### `kimi_analysis`
- **参数**：`source`、`paperId`。
- **输出**：`faqs` 数组，每项包含 `question` 与纯文本 `answer`，附带 FAQ 条目总数。

## 运行机制与目录
- `src/cool-papers.ts`：使用 Axios + Cheerio 抓取搜索结果、详情页、PDF 链接及 Kimi FAQ。
- `src/scholar-server.ts`：定义 MCP 工具、参数校验、输出净化逻辑。
- `scripts/cool-papers-smoke.ts`：冒烟测试脚本，被 `npm run test:cool` 调用。
- `test-downloads/`：默认示例下载目录，可在工具调用时自定义。

## 故障排除
- **无法联网**：确认能直接访问 `https://papers.cool/`，并适当降低请求频率以避免限流。
- **下载失败**：检查目标目录是否存在写权限，或站点是否暂时关闭 PDF。
- **Kimi FAQ 为空**：部分论文尚未生成 FAQ，工具会返回空数组。

## 许可证

本项目以 MIT License 授权，欢迎提交 Issue / PR 共同维护。
