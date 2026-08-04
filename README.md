# 拾光拼图 H5 Demo

基于 React 18、Vite 和 antd-mobile 的移动端拼图活动页。

## 开始使用

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 调整拼图规格

编辑 `src/config/puzzle.js`：

```js
export const PUZZLE_CONFIG = {
  columns: 100,
  rows: 200,
  aspectRatio: 9 / 16,
  imageUrl: '/images/jiaoxuelou.svg',
  mockAcquiredCount: 19200,
  mockSeed: 20260804,
}
```

`columns` 和 `rows` 可独立调整；当前默认值为 `100 × 200`，共 20,000 块。`mockAcquiredCount` 控制 Mock 初始化点亮数量，`mockSeed` 固定伪随机坐标分布，便于刷新页面或比较渲染方案时复用同一批样本。

拼图区域使用单个可见 Canvas 和逻辑状态蒙版，不会为每一块创建 DOM 节点；随机领取、手动点亮和取消点亮都使用带位置索引的定长数组交换，单次状态变更的时间复杂度为 O(1)。移动端支持轻点切换拼图状态、双指缩放和单指拖动，桌面端支持轻点、滚轮和按钮缩放。

## 性能对照

默认启用视口级高清 Canvas；添加 `?perf=1` 可采集性能数据，添加 `&renderer=baseline` 可切换到固定 `900 × 1600` Canvas 加 CSS 缩放的基线实现。该开关仅用于本地对照，不应作为生产功能入口。测试结论见 `docs/puzzle-performance-20000.md`。

## 后端状态同步

`PuzzleViewport` 的点击回调会提供块编号、零基行列、逻辑坐标、画布坐标和当前变换信息。`createPuzzlePieceChangePayload` 会将其转换为适合接口提交的结构：

```js
{
  action: 'light', // 或 'unlight'
  isAcquired: true,
  pieceIndex: 3525,
  row: 35,
  column: 25,
  x: 25,
  y: 35,
}
```

后端接口接入后，将 `updatePuzzlePieceState` 作为 `App` 的 `onPuzzlePieceChange` 传入即可。此时页面会先等待服务端结果，再以返回的 `isAcquired` 作为最终状态；接口地址当前预留为 `POST /puzzle/pieces/state`。
