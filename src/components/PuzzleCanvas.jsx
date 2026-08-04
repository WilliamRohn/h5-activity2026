import { memo, useEffect, useRef, useState } from 'react'
import { clamp, getCoverSourceRect } from '../utils/puzzle'
import {
  markPuzzleReady,
  measurePuzzlePerformance,
  recordPuzzleInteraction,
  recordPuzzleRender,
} from '../utils/performance'

const MASK_FILTER = 'grayscale(1) brightness(1.2) contrast(0.56)'
const MASK_COLOR = 'rgba(240, 241, 238, 0.78)'
const MAX_DEVICE_PIXEL_RATIO = 3

const resizeCanvas = (canvas, width, height) => {
  if (canvas.width === width && canvas.height === height) return
  canvas.width = width
  canvas.height = height
}

const createBuffer = () => document.createElement('canvas')

const syncStateMask = (maskCanvas, pieceStates, columns, rows) => {
  resizeCanvas(maskCanvas, columns, rows)
  const context = maskCanvas.getContext('2d')
  const imageData = context.createImageData(columns, rows)

  for (let pieceIndex = 0; pieceIndex < pieceStates.length; pieceIndex += 1) {
    if (pieceStates[pieceIndex] !== 1) continue
    const dataIndex = pieceIndex * 4
    imageData.data[dataIndex] = 255
    imageData.data[dataIndex + 1] = 255
    imageData.data[dataIndex + 2] = 255
    imageData.data[dataIndex + 3] = 255
  }

  context.putImageData(imageData, 0, 0)
}

const updateStateMask = (maskCanvas, change, columns) => {
  const context = maskCanvas.getContext('2d')
  const column = change.pieceIndex % columns
  const row = Math.floor(change.pieceIndex / columns)
  context.clearRect(column, row, 1, 1)

  if (change.isAcquired) {
    context.fillStyle = '#fff'
    context.fillRect(column, row, 1, 1)
  }
}

const drawImageLayer = ({
  canvas,
  image,
  sourceRect,
  viewportSize,
  transform,
  dpr,
  isGrayscale,
}) => {
  const context = canvas.getContext('2d')
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.setTransform(
    dpr * transform.scale,
    0,
    0,
    dpr * transform.scale,
    dpr * transform.x,
    dpr * transform.y,
  )
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.filter = isGrayscale ? MASK_FILTER : 'none'
  context.drawImage(
    image,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    viewportSize.width,
    viewportSize.height,
  )

  if (isGrayscale) {
    context.filter = 'none'
    context.fillStyle = MASK_COLOR
    context.fillRect(0, 0, viewportSize.width, viewportSize.height)
  }

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.filter = 'none'
}

const drawGrid = (
  context,
  viewportSize,
  transform,
  columns,
  rows,
  dpr,
) => {
  const scaledPieceWidth = (viewportSize.width / columns) * transform.scale
  const scaledPieceHeight = (viewportSize.height / rows) * transform.scale
  const firstColumn = clamp(
    Math.floor(-transform.x / scaledPieceWidth),
    0,
    columns,
  )
  const lastColumn = clamp(
    Math.ceil((viewportSize.width - transform.x) / scaledPieceWidth),
    0,
    columns,
  )
  const firstRow = clamp(
    Math.floor(-transform.y / scaledPieceHeight),
    0,
    rows,
  )
  const lastRow = clamp(
    Math.ceil((viewportSize.height - transform.y) / scaledPieceHeight),
    0,
    rows,
  )

  context.save()
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.beginPath()

  for (let column = firstColumn; column <= lastColumn; column += 1) {
    const x = Math.round(
      (transform.x + column * scaledPieceWidth) * dpr,
    ) + 0.5
    context.moveTo(x, 0)
    context.lineTo(x, viewportSize.height * dpr)
  }

  for (let row = firstRow; row <= lastRow; row += 1) {
    const y = Math.round(
      (transform.y + row * scaledPieceHeight) * dpr,
    ) + 0.5
    context.moveTo(0, y)
    context.lineTo(viewportSize.width * dpr, y)
  }

  context.strokeStyle = 'rgba(94, 103, 99, 0.22)'
  context.lineWidth = 1
  context.stroke()
  context.restore()
}

function PuzzleCanvas({
  columns,
  rows,
  imageUrl,
  aspectRatio,
  viewportSize,
  transform,
  changeLog,
  changeRevision,
  snapshotRevision,
  pieceStates,
}) {
  const canvasRef = useRef(null)
  const imageRef = useRef(null)
  const sourceRectRef = useRef(null)
  const buffersRef = useRef(null)
  if (buffersRef.current === null) {
    buffersRef.current = {
      color: createBuffer(),
      grayscale: createBuffer(),
      composite: createBuffer(),
      mask: createBuffer(),
    }
  }
  const renderStateRef = useRef({
    fullKey: '',
    sequence: 0,
    snapshotRevision: -1,
  })
  const [loadState, setLoadState] = useState('loading')

  useEffect(() => {
    let isCancelled = false
    const image = new Image()
    const startedAt = performance.now()
    image.decoding = 'async'

    setLoadState('loading')
    image.onload = () => {
      if (isCancelled) return

      imageRef.current = image
      sourceRectRef.current = getCoverSourceRect(
        image.naturalWidth,
        image.naturalHeight,
        aspectRatio,
      )
      measurePuzzlePerformance('svg-image-load', startedAt, {
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
      setLoadState('ready')
    }
    image.onerror = () => {
      if (!isCancelled) setLoadState('error')
    }
    image.src = imageUrl

    return () => {
      isCancelled = true
      image.onload = null
      image.onerror = null
    }
  }, [aspectRatio, imageUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    const sourceRect = sourceRectRef.current
    if (
      loadState !== 'ready'
      || !canvas
      || !image
      || !sourceRect
      || viewportSize.width <= 0
      || viewportSize.height <= 0
    ) {
      return
    }

    const buffers = buffersRef.current
    const renderState = renderStateRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
    const pixelWidth = Math.max(1, Math.round(viewportSize.width * dpr))
    const pixelHeight = Math.max(1, Math.round(viewportSize.height * dpr))
    const pendingChanges = []

    if (renderState.snapshotRevision !== snapshotRevision) {
      syncStateMask(buffers.mask, pieceStates, columns, rows)
      renderState.snapshotRevision = snapshotRevision
      renderState.sequence = 0
    }

    for (
      let sequence = renderState.sequence + 1;
      sequence <= changeRevision;
      sequence += 1
    ) {
      const change = changeLog[sequence - 1]
      updateStateMask(buffers.mask, change, columns)
      pendingChanges.push(change)
    }

    const fullKey = [
      pixelWidth,
      pixelHeight,
      transform.x,
      transform.y,
      transform.scale,
      snapshotRevision,
      loadState,
    ].join(':')
    const needsFullRender = renderState.fullKey !== fullKey
    const startedAt = performance.now()

    if (needsFullRender) {
      resizeCanvas(canvas, pixelWidth, pixelHeight)
      resizeCanvas(buffers.color, pixelWidth, pixelHeight)
      resizeCanvas(buffers.grayscale, pixelWidth, pixelHeight)
      resizeCanvas(buffers.composite, pixelWidth, pixelHeight)

      drawImageLayer({
        canvas: buffers.grayscale,
        image,
        sourceRect,
        viewportSize,
        transform,
        dpr,
        isGrayscale: true,
      })
      drawImageLayer({
        canvas: buffers.color,
        image,
        sourceRect,
        viewportSize,
        transform,
        dpr,
        isGrayscale: false,
      })

      const compositeContext = buffers.composite.getContext('2d')
      compositeContext.setTransform(1, 0, 0, 1, 0, 0)
      compositeContext.globalCompositeOperation = 'source-over'
      compositeContext.clearRect(0, 0, pixelWidth, pixelHeight)
      compositeContext.drawImage(buffers.color, 0, 0)
      compositeContext.globalCompositeOperation = 'destination-in'
      compositeContext.imageSmoothingEnabled = false
      compositeContext.setTransform(dpr, 0, 0, dpr, 0, 0)
      compositeContext.drawImage(
        buffers.mask,
        transform.x,
        transform.y,
        viewportSize.width * transform.scale,
        viewportSize.height * transform.scale,
      )
      compositeContext.setTransform(1, 0, 0, 1, 0, 0)
      compositeContext.globalCompositeOperation = 'source-over'

      const context = canvas.getContext('2d', { alpha: false })
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.fillStyle = '#e6e5df'
      context.fillRect(0, 0, pixelWidth, pixelHeight)
      context.drawImage(buffers.grayscale, 0, 0)
      context.drawImage(buffers.composite, 0, 0)
      drawGrid(context, viewportSize, transform, columns, rows, dpr)
      renderState.fullKey = fullKey
    } else if (pendingChanges.length > 0) {
      const context = canvas.getContext('2d', { alpha: false })
      const pieceWidth = (viewportSize.width / columns) * transform.scale
      const pieceHeight = (viewportSize.height / rows) * transform.scale

      pendingChanges.forEach((change) => {
        const column = change.pieceIndex % columns
        const row = Math.floor(change.pieceIndex / columns)
        const left = Math.floor(
          (transform.x + column * pieceWidth) * dpr,
        )
        const top = Math.floor(
          (transform.y + row * pieceHeight) * dpr,
        )
        const right = Math.ceil(
          (transform.x + (column + 1) * pieceWidth) * dpr,
        )
        const bottom = Math.ceil(
          (transform.y + (row + 1) * pieceHeight) * dpr,
        )

        if (
          right <= 0
          || bottom <= 0
          || left >= pixelWidth
          || top >= pixelHeight
        ) {
          return
        }

        context.save()
        context.beginPath()
        context.rect(left, top, right - left, bottom - top)
        context.clip()
        context.drawImage(
          change.isAcquired ? buffers.color : buffers.grayscale,
          0,
          0,
        )
        context.restore()
      })

      drawGrid(context, viewportSize, transform, columns, rows, dpr)
    }

    renderState.sequence = changeRevision

    if (needsFullRender || pendingChanges.length > 0) {
      const duration = performance.now() - startedAt
      const reason = needsFullRender ? 'viewport' : 'incremental'
      recordPuzzleRender({ duration, reason, renderer: 'optimized' })

      if (snapshotRevision > 0) {
        markPuzzleReady({ duration, renderer: 'optimized', dpr })
      }

      if (pendingChanges.length > 0) {
        const recentPieceIndex = pendingChanges.at(-1).pieceIndex
        const interactionDuration = measurePuzzlePerformance(
          'piece-interaction-painted',
          'piece-interaction-start',
          { pieceIndex: recentPieceIndex, renderer: 'optimized' },
        )
        recordPuzzleInteraction({
          duration: interactionDuration,
          pieceIndex: recentPieceIndex,
          renderer: 'optimized',
        })
      }
    }
  }, [
    changeLog,
    changeRevision,
    columns,
    loadState,
    pieceStates,
    rows,
    snapshotRevision,
    transform.scale,
    transform.x,
    transform.y,
    viewportSize.height,
    viewportSize.width,
  ])

  return (
    <>
      <canvas ref={canvasRef} className="puzzle-canvas" />
      {loadState !== 'ready' && (
        <div className="puzzle-loading" role="status">
          {loadState === 'error' ? '拼图图片加载失败' : '正在展开画卷…'}
        </div>
      )}
    </>
  )
}

export default memo(PuzzleCanvas)
