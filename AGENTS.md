# 仓库协作说明

## 项目结构与模块组织

- `src/main.jsx` 是 React 入口，同时根据移动端视口设置根节点 `font-size`，用于 rem 适配。
- `src/App.jsx` 包含活动页结构、拼图渲染和随机领取逻辑。
- `src/config/puzzle.js` 集中维护拼图行列数与图片地址；调整规格时优先修改此文件。
- `src/styles/` 存放全局样式与页面样式。尺寸统一使用 rem，安全区域使用 `env(safe-area-inset-*)`。
- `src/services/http.js` 是 Axios 实例，后续接口请求在此基础上扩展。
- `public/images/` 存放无需打包转换的活动图片资源。
- `dist/` 是生产构建产物，`node_modules/` 是本地依赖，二者均不提交。

## 开发与构建命令

- `npm install`：安装依赖并生成或更新锁文件。
- `npm run dev`：启动 Vite 开发服务器，并监听所有网络接口，便于移动设备联调。
- `npm run build`：生成生产构建到 `dist/`，也是提交前的必做验证。
- `npm run preview`：在本地预览已生成的生产构建。

当前仓库没有配置 lint 或自动化测试脚本；不要在说明或提交记录中声称执行过这些检查。

## 编码风格与命名规范

- 使用 ES Modules、React 函数组件和 Hooks；组件使用 PascalCase，变量与函数使用 camelCase，常量使用 UPPER_SNAKE_CASE。
- JavaScript/JSX 使用 2 个空格缩进、单引号、尾逗号，并保持现有的无分号风格。
- 页面尺寸使用 rem，不新增固定 px 布局；1rem 按 375px 设计稿对应 100px 计算，并在 430px 视口宽度处封顶。
- 复用 `PUZZLE_CONFIG`，不要在组件或样式中重复硬编码拼图总数。拼图领取必须从剩余块中选择，保持不重复语义。
- 样式类名使用 kebab-case；状态类使用 `块名--状态` 形式，例如 `puzzle-piece--acquired`。
- 面向用户的文案保持简洁中文；交互反馈优先使用 antd-mobile 组件。

## 验证要求

- 每次改动后至少执行 `npm run build`。
- 修改拼图逻辑时，手动验证初始状态全灰、单次领取只点亮一块、重复点击不重复、全部领取后按钮禁用。
- 修改布局配置时，至少验证非默认行列数组合，并检查背景图切片能完整拼合。
- 修改移动端样式时，检查 320px、375px 和 430px 宽度，以及底部安全区域。
- 尊重 `prefers-reduced-motion`，新增动效需提供关闭或降级方案。

## 提交与拉取请求

- 当前目录没有可用的 Git 历史，提交消息使用简洁的祈使句并描述单一目的，例如 `feat: add puzzle progress persistence`。
- 拉取请求说明应包含改动摘要、验证命令和移动端页面截图；交互变化需列出手动验证路径。
- 不提交 `dist/`、`node_modules/`、编辑器配置或本地日志。

## 安全与配置注意事项

- API 地址通过 `VITE_API_BASE_URL` 注入；仅在 `.env.local` 等本地文件保存环境差异，并确保其中不包含可暴露到浏览器的机密。
- 所有 `VITE_` 变量都会进入前端产物，禁止放置密钥、令牌或私有凭据。
- 接入后端领取接口时，以服务端结果为最终依据，不依赖前端随机逻辑保障奖品唯一性或安全性。
