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

`columns` 和 `rows` 可独立调整；页面会按配置自动生成网格、切分背景图并计算进度。
