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
  columns: 5,
  rows: 5,
  imageUrl: '/images/summer-journey.svg',
}
```

`columns` 和 `rows` 可独立调整；当前默认值为 `100 × 100`，用于验证万级拼图场景。

拼图区域使用单个 Canvas 增量绘制已获得的块，不会为每一块创建 DOM 节点；随机领取使用定长数组交换，领取一块的时间复杂度为 O(1)。移动端支持双指缩放、单指拖动，桌面端支持滚轮、双击和按钮缩放。
