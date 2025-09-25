# Scholar MCP

一个用于搜索和获取学术论文的 MCP (Model Context Protocol) 工具，支持 arXiv 和 DBLP 两个主要学术数据库。

## 功能特性

- 🔍 **智能搜索**: 支持关键词搜索，可按作者、时间、分类筛选
- 📄 **详细信息**: 获取论文标题、作者、摘要、发表时间等完整信息
- 📥 **PDF下载**: 提供论文PDF下载链接
- 🎯 **多源支持**: 同时支持 arXiv 和 DBLP 数据源
- 🔧 **易于集成**: 标准MCP接口，可轻松集成到Claude等AI助手

## 安装和配置

### 1. 安装依赖

```bash
npm install
```

**注意**: 本项目使用 `npx @modelcontextprotocol/server-node` 来启动MCP服务器，这样可以确保使用最新版本的MCP服务器运行时，无需单独安装。

### 2. 编译项目

```bash
npm run build
```

### 3. 开发模式

```bash
npm run dev
```

### 4. 运行测试

```bash
npm test
```

## MCP Server 配置

### Claude Code 配置

#### 方法一：通过命令行添加

```bash
# 添加 scholar-mcp server 到 Claude Code
claude mcp add scholar-mcp npx @modelcontextprotocol/server-node /path/to/scholar-mcp/dist/scholar-server.js
```

#### 方法二：手动编辑配置文件

Claude Code 的配置文件通常位于：
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

在配置文件中添加以下内容：

```json
{
  "mcpServers": {
    "scholar-mcp": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-node", "/path/to/scholar-mcp/dist/scholar-server.js"],
      "env": {}
    }
  }
}
```

**注意**: 请将 `/path/to/scholar-mcp` 替换为实际的项目路径。

#### 使用示例

配置完成后，重启 Claude Code，然后你就可以在对话中使用学术搜索功能：

```
请帮我搜索关于 "transformer architecture" 的最新论文
```

```
获取论文 ID 为 1706.03762 的详细信息
```

### VSCode 配置

#### 安装 MCP 插件

1. 在 VSCode 中搜索并安装 "MCP" 或 "Model Context Protocol" 相关插件
2. 或使用 Continue.dev 等支持 MCP 的插件

#### 配置 Continue.dev

在 VSCode 中安装 Continue.dev 后，创建或编辑 `~/.continue/config.json`：

```json
{
  "experimental": {
    "modelContextProtocol": true
  },
  "providers": [
    {
      "name": "scholar-mcp",
      "type": "mcp",
      "config": {
        "command": "npx",
        "args": ["@modelcontextprotocol/server-node", "/path/to/scholar-mcp/dist/scholar-server.js"]
      }
    }
  ]
}
```

### Cherry Studio 配置

Cherry Studio 是一个支持 MCP 的桌面 AI 助手应用。

#### 配置步骤

1. 打开 Cherry Studio
2. 进入设置 (Settings)
3. 找到 "MCP Servers" 或 "Model Context Protocol" 选项
4. 添加新的 MCP Server：

```json
{
  "name": "scholar-mcp",
  "command": "npx",
  "args": ["@modelcontextprotocol/server-node", "/path/to/scholar-mcp/dist/scholar-server.js"],
  "description": "Academic paper search and retrieval tool"
}
```

5. 保存配置并重启 Cherry Studio

#### 使用方法

在 Cherry Studio 中，你可以直接使用自然语言进行学术搜索：

```
搜索最近5年关于机器学习的论文
```

```
帮我查找关于量子计算的相关研究
```

### 其他支持 MCP 的客户端

#### 通用配置格式

大多数支持 MCP 的客户端都使用以下配置格式：

```json
{
  "mcpServers": {
    "scholar-mcp": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-node", "/path/to/scholar-mcp/dist/scholar-server.js"],
      "env": {},
      "description": "Academic paper search and retrieval from arXiv and DBLP"
    }
  }
}
```

#### 命令行测试

你可以使用 `npx` 直接测试 MCP server：

```bash
# 测试 MCP server
npx @modelcontextprotocol/server-node /path/to/scholar-mcp/dist/scholar-server.js
```

#### Docker 部署

创建 Dockerfile：

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npx", "@modelcontextprotocol/server-node", "dist/scholar-server.js"]
```

构建和运行：

```bash
docker build -t scholar-mcp .
docker run -p 3000:3000 scholar-mcp
```

### 快速开始

对于新手用户，可以使用以下命令快速开始：

```bash
# 1. 安装依赖
npm install

# 2. 编译项目
npm run build

# 3. 测试功能
npm run search-test "machine learning"

# 4. 启动 server
npm run server
```

### 项目路径获取

在配置 MCP 客户端时，需要使用项目的绝对路径。可以通过以下方式获取：

```bash
# macOS/Linux
pwd
# 输出: /Users/yourname/Projects/scholar-mcp

# Windows
cd
echo %CD%
# 输出: C:\Users\yourname\Projects\scholar-mcp
```

### 常用命令

```bash
# 编译项目
npm run build

# 启动开发模式
npm run dev

# 运行搜索测试
npm run search-test "your query"


# 启动 MCP server (使用npx)
npm run server

# 清理编译文件
npm run clean
```

## MCP工具接口

### search_papers

搜索学术论文，返回完整信息包括摘要和PDF链接。

**参数:**
- `query` (string, 必需): 搜索关键词
- `source` (string, 可选): 搜索源 ('arxiv', 'dblp', 'both')，默认为 'both'
- `maxResults` (number, 可选): 最大结果数 (1-100)，默认为 10
- `startDate` (string, 可选): 开始日期 (YYYY-MM-DD格式)
- `endDate` (string, 可选): 结束日期 (YYYY-MM-DD格式)
- `author` (string, 可选): 作者筛选
- `category` (string, 可选): 分类筛选 (仅arXiv)

**返回信息包括:**
- 论文标题、作者、摘要、发表时间
- PDF下载链接
- 分类、DOI等信息

**示例:**
```json
{
  "query": "machine learning",
  "source": "both",
  "maxResults": 10,
  "author": "Geoffrey Hinton",
  "category": "cs.LG"
}
```


### download_paper

批量下载arXiv论文，支持通过论文ID列表、搜索关键词或作者进行下载。

**参数:**
- `downloadFolder` (string, 必需): 下载文件夹路径
- `paperIds` (array, 可选): 论文ID列表，如 ["1706.03762", "2301.00001"]
- `query` (string, 可选): 搜索关键词，自动搜索并下载相关论文
- `author` (string, 可选): 作者姓名，下载该作者的所有论文
- `maxResults` (number, 可选): 最大下载数量（搜索/作者模式），默认10，最大100
- `startDate` (string, 可选): 开始日期筛选 (YYYY-MM-DD格式)
- `endDate` (string, 可选): 结束日期筛选 (YYYY-MM-DD格式)
- `category` (string, 可选): 分类筛选 (arXiv分类代码，如 "cs.LG")

**使用示例:**

1. **按论文ID下载:**
```json
{
  "downloadFolder": "/path/to/papers",
  "paperIds": ["1706.03762", "2301.00001"]
}
```

2. **按关键词搜索下载:**
```json
{
  "downloadFolder": "/path/to/papers",
  "query": "transformer architecture",
  "maxResults": 5,
  "category": "cs.LG"
}
```

3. **按作者下载:**
```json
{
  "downloadFolder": "/path/to/papers",
  "author": "Geoffrey Hinton",
  "maxResults": 10,
  "startDate": "2020-01-01",
  "endDate": "2023-12-31"
}
```

**返回信息:**
- `success`: 下载是否成功
- `downloaded`: 成功下载的论文列表（包含标题、文件路径、大小等信息）
- `failed`: 下载失败的论文列表及原因
- `message`: 操作结果摘要
- `downloadFolder`: 使用的下载文件夹路径

## 支持的数据源

### arXiv

- **API**: http://export.arxiv.org/api/query
- **搜索语法**: 支持标准arXiv搜索语法
- **特色**: 预印本、计算机科学、物理等领域
- **限制**: 无API密钥要求，但有请求频率限制

### DBLP

- **API**: https://dblp.org/search/publ/api
- **搜索语法**: 支持作者、标题、关键词搜索
- **特色**: 计算机科学文献数据库，包含会议和期刊论文
- **限制**: 无API密钥要求

## 开发说明

### 项目结构

```
scholar-mcp/
├── src/
│   ├── types.ts              # 类型定义
│   ├── arxiv.ts              # arXiv API模块
│   ├── dblp.ts               # DBLP API模块
│   ├── scholar-server.ts     # MCP服务器实现
│   └── index.ts              # 入口文件
├── tests/
│   ├── arxiv.test.js         # arXiv模块测试
│   └── dblp.test.js          # DBLP模块测试
├── dist/                     # 编译输出
└── package.json              # 项目配置
```

### 扩展功能

可以通过以下方式扩展工具功能：

1. **添加新的数据源**: 在 `src/` 目录下创建新的API模块
2. **增强搜索功能**: 添加更多搜索参数和筛选条件
3. **改进结果处理**: 优化结果排序和格式化
4. **添加缓存机制**: 减少API请求次数

## 故障排除

### 常见问题

#### 1. MCP Server 无法启动

确保项目已正确编译：

```bash
npm run build
```

检查 Node.js 版本（推荐 v18+）：

```bash
node --version
```

#### 2. 配置文件路径错误

确保配置文件中的路径是绝对路径：

```json
{
  "args": ["/Users/yourname/Projects/scholar-mcp/dist/scholar-server.js"]
}
```

#### 3. 权限问题

确保有执行脚本的权限：

```bash
chmod +x dist/scholar-server.js
```

#### 4. 网络连接问题

如果遇到 DBLP 或 arXiv API 连接问题，可能是：
- 网络连接问题
- API 服务器暂时不可用
- 请求频率过高

### 调试方法

#### 启用详细日志

设置环境变量启用调试：

```bash
DEBUG=scholar-mcp:* node dist/scholar-server.js
```

#### 测试工具功能

使用测试文件验证功能：

```bash
# 测试搜索功能
node tests/search-test.js "machine learning"

```

## 使用示例

### 基础搜索

```
搜索关于 "neural networks" 的论文
```

### 高级搜索

```
搜索2023年发表的关于 "transformer" 的论文，限制结果为10篇
```

### 按作者搜索

```
搜索作者 "Geoffrey Hinton" 的论文
```


### 下载论文

```
下载论文ID为1706.03762的论文到指定文件夹
```

```
搜索并下载关于"transformer"的最新论文
```

```
下载Geoffrey Hinton2020年以来的所有论文
```

## 性能优化

### 缓存策略

- 本地缓存搜索结果
- 智能重试机制
- 请求频率限制

### 建议的使用方式

1. **精确搜索**: 使用具体的关键词组合
2. **时间筛选**: 限制搜索时间范围以提高相关性
3. **作者筛选**: 如果知道特定作者，使用作者筛选
4. **分类筛选**: 在 arXiv 中使用分类代码

## 注意事项

- 本工具仅用于学术研究目的
- 使用时请遵守各数据源的使用条款
- 建议适当控制请求频率，避免对服务器造成过大负担
- 部分论文可能需要订阅或购买才能获取完整内容
- 请尊重学术成果的版权和使用规定

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 支持

如果你在使用过程中遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查项目的 Issues 页面
3. 创建新的 Issue 描述问题