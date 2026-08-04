import { memo, useEffect, useRef, useState } from 'react'
import { getCoverSourceRect } from '../utils/puzzle'
import {
  markPuzzleReady,
  measurePuzzlePerformance,
  recordPuzzleInteraction,
  recordPuzzleRender,
} from '../utils/performance'

const MASK_FILTER = 'grayscale(1) brightness(1.2) contrast(0.56)'
const MASK_COLOR = 'rgba(240, 241, 238, 0.78)'

const getPieceRect = (
  canvas,
  sourceRect,
  pieceIndex,
  columns,
  rows,
) => {
  const column = pieceIndex % columns
  const row = Math.floor(pieceIndex / columns)
  const destinationX = Math.round((column * canvas.width) / columns)
  const destinationY = Math.round((row * canvas.height) / rows)
  const destinationRight = Math.round(((column + 1) * canvas.width) / columns)
  const destinationBottom = Math.round(((row + 1) * canvas.height) / rows)

  return {
    sourceX: sourceRect.x + (column * sourceRect.width) / columns,
    sourceY: sourceRect.y + (row * sourceRect.height) / rows,
    sourceWidth: sourceRect.width / columns,
    sourceHeight: sourceRect.height / rows,
    destinationX,
    destinationY,
    destinationWidth: destinationRight - destinationX,
    destinationHeight: destinationBottom - destinationY,
  }
}

const drawBaseImage = (canvas, image, sourceRect, width, height) => {
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', { alpha: false })
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.filter = MASK_FILTER
  context.drawImage(
    image,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    width,
    height,
  )
  context.filter = 'none'
  context.fillStyle = MASK_COLOR
  context.fillRect(0, 0, width, height)
}

const drawPieceState = (
  canvas,
  image,
  sourceRect,
  pieceIndex,
  columns,
  rows,
  isAcquired,
) => {
  const context = canvas.getContext('2d', { alpha: false })
  const rect = getPieceRect(
    canvas,
    sourceRect,
    pieceIndex,
    columns,
    rows,
  )

  context.save()
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.filter = isAcquired ? 'none' : MASK_FILTER
  context.drawImage(
    image,
    rect.sourceX,
    rect.sourceY,
    rect.sourceWidth,
    rect.sourceHeight,
    rect.destinationX,
    rect.destinationY,
    rect.destinationWidth,
    rect.destinationHeight,
  )

  if (!isAcquired) {
    context.filter = 'none'
    context.fillStyle = MASK_COLOR
    context.fillRect(
      rect.destinationX,
      rect.destinationY,
      rect.destinationWidth,
      rect.destinationHeight,
    )
  }

  context.restore()
}

function LegacyPuzzleCanvas({
  columns,
  rows,
  imageUrl,
  aspectRatio,
  canvasWidth,
  canvasHeight,
  changeLog,
  changeRevision,
  snapshotRevision,
  pieceStates,
}) {
  const canvasRef = useRef(null)
  const imageRef = useRef(null)
  const sourceRectRef = useRef(null)
  const renderedSequenceRef = useRef(0)
  const renderedSnapshotRef = useRef(-1)
  const latestPuzzleRef = useRef({
    changeRevision,
    pieceStates,
    snapshotRevision,
  })
  const [loadState, setLoadState] = useState('loading')

  latestPuzzleRef.current = {
    changeRevision,
    pieceStates,
    snapshotRevision,
  }

  const renderSnapshot = (reason) => {
    const canvas = canvasRef.current
    const image = imageRef.current
    const sourceRect = sourceRectRef.current
    if (!canvas || !image || !sourceRect) return

    const startedAt = performance.now()
    const currentPuzzle = latestPuzzleRef.current
    drawBaseImage(canvas, image, sourceRect, canvasWidth, canvasHeight)

    for (
      let pieceIndex = 0;
      pieceIndex < currentPuzzle.pieceStates.length;
      pieceIndex += 1
    ) {
      if (currentPuzzle.pieceStates[pieceIndex] === 1) {
        drawPieceState(
          canvas,
          image,
          sourceRect,
          pieceIndex,
          columns,
          rows,
          true,
        )
      }
    }

    const duration = performance.now() - startedAt
    renderedSequenceRef.current = currentPuzzle.changeRevision
    renderedSnapshotRef.current = currentPuzzle.snapshotRevision
    recordPuzzleRender({ duration, reason, renderer: 'baseline' })

    if (currentPuzzle.snapshotRevision > 0) {
      markPuzzleReady({ duration, renderer: 'baseline' })
    }
  }

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
      renderSnapshot('image-load')
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
  }, [aspectRatio, canvasHeight, canvasWidth, columns, imageUrl, rows])

  useEffect(() => {
    if (
      loadState !== 'ready'
      || snapshotRevision === renderedSnapshotRef.current
    ) {
      return
    }

    renderSnapshot('snapshot')
  }, [loadState, snapshotRevision])

  useEffect(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    const sourceRect = sourceRectRef.current
    if (
      !canvas
      || !image
      || !sourceRect
      || loadState !== 'ready'
      || changeRevision <= renderedSequenceRef.current
    ) {
      return
    }

    const startedAt = performance.now()
    let recentPieceIndex
    for (
      let sequence = renderedSequenceRef.current + 1;
      sequence <= changeRevision;
      sequence += 1
    ) {
      const change = changeLog[sequence - 1]
      recentPieceIndex = change.pieceIndex
      drawPieceState(
        canvas,
        image,
        sourceRect,
        change.pieceIndex,
        columns,
        rows,
        change.isAcquired,
      )
    }

    const duration = performance.now() - startedAt
    renderedSequenceRef.current = changeRevision
    recordPuzzleRender({ duration, reason: 'incremental', renderer: 'baseline' })
    const interactionDuration = measurePuzzlePerformance(
      'piece-interaction-painted',
      'piece-interaction-start',
      { pieceIndex: recentPieceIndex, renderer: 'baseline' },
    )
    recordPuzzleInteraction({
      duration: interactionDuration,
      pieceIndex: recentPieceIndex,
      renderer: 'baseline',
    })
  }, [changeLog, changeRevision, columns, loadState, rows])

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

export default memo(LegacyPuzzleCanvas)
