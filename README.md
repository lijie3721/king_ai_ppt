# AI PPT

AI PPT 是一个本地运行的 HTML PPT 编辑器，可以把 Markdown 或 AI 生成的大纲变成可编辑的课件/汇报幻灯片。它支持主题、版式、图片、Logo、文本拖动、演讲模式和 DeepSeek AI 优化。

## 一键安装 macOS

同事电脑上先安装 Git，然后在终端执行：

```bash
git clone git@github.com:lijie3721/ai-ppt.git
cd ai-ppt
./scripts/setup-macos.sh
```

如果同事没有配置 GitHub SSH，也可以用 HTTPS 地址：

```bash
git clone https://github.com/lijie3721/ai-ppt.git
cd ai-ppt
./scripts/setup-macos.sh
```

安装完成后，脚本会提示填写 DeepSeek Key。填写完成后启动：

```bash
./scripts/start-macos.sh
```

打开浏览器访问：

```text
http://127.0.0.1:5173/
```

停止服务：回到终端按 `Ctrl + C`。

## DeepSeek 配置

项目不会提交真实 `.env`。首次安装时脚本会从 `.env.example` 自动复制一份 `.env`。

打开 `.env`，把下面这一行改成真实 Key：

```bash
DEEPSEEK_API_KEY=replace_with_your_deepseek_key
```

默认配置如下：

```bash
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
AI_PPT_API_PORT=4174
```

修改 `.env` 后需要重新启动：

```bash
./scripts/start-macos.sh
```

## 常用命令

```bash
npm run dev
```

同时启动前端和本地 AI API 服务。

```bash
npm run build
```

检查生产构建。

```bash
npm test
```

运行自动化测试。

## 常见问题

### 提示还没有配置 DeepSeek API Key

确认 `.env` 里已经填写真实 `DEEPSEEK_API_KEY`，然后重启 `./scripts/start-macos.sh`。

### 端口被占用

默认前端端口是 `5173`，本地 API 端口是 `4174`。如果启动失败，先关闭旧终端窗口，或执行：

```bash
lsof -ti tcp:5173
lsof -ti tcp:4174
```

看到进程号后可以结束对应进程：

```bash
kill <进程号>
```

### Node.js 未安装

推荐安装 Node.js 20 或更高版本：

```bash
brew install node
```

也可以从官网下载：

```text
https://nodejs.org/
```

## 不要提交的文件

这些文件只属于本地环境，不要上传到 GitHub：

- `.env`
- `node_modules/`
- `dist/`
- `.DS_Store`

