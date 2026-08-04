import { useEffect, useRef, useState } from 'react'
import {
  clamp,
  clampViewportTransform,
  getPieceInfoAtPoint,
} from '../utils/puzzle'
import {
  markPuzzlePerformance,
  recordPuzzleFrame,
} from '../utils/performance'
import LegacyPuzzleCanvas from './LegacyPuzzleCanvas'
import PuzzleCanvas from './PuzzleCanvas'

const INITIAL_TRANSFORM = { x: 0, y: 0, scale: 1 }
const TAP_MOVE_THRESHOLD = 8

const getPoint = (event, element) => {
  const bounds = element.getBoundingClientRect()
  return {
    x: event.clientX - bounds.left - element.clientLeft,
    y: event.clientY - bounds.top - element.clientTop,
  }
}

const getMidpoint = (first, second) => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
})

const getDistance = (first, second) => Math.hypot(
  second.x - first.x,
  second.y - first.y,
)

function PuzzleViewport({
  columns,
  rows,
  imageUrl,
  aspectRatio,
  baselineCanvasWidth,
  baselineCanvasHeight,
  minScale,
  maxScale,
  rendererMode,
  changeLog,
  changeRevision,
  snapshotRevision,
  pieceStates,
  revealedCount,
  recentChange,
  isProgressLoading,
  onPieceTap,
}) {
  const viewportRef = useRef(null)
  const gestureRef = useRef({ pointers: new Map(), mode: null })
  const transformRef = useRef(INITIAL_TRANSFORM)
  const pendingTransformRef = useRef(INITIAL_TRANSFORM)
  const transformFrameRef = useRef(null)
  const lastTransformFrameRef = useRef(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [transform, setTransform] = useState(INITIAL_TRANSFORM)

  const commitTransform = () => {
    transformFrameRef.current = null
    const now = performance.now()
    if (lastTransformFrameRef.current !== null) {
      recordPuzzleFrame(now - lastTransformFrameRef.current)
    }
    lastTransformFrameRef.current = now
    setTransform(pendingTransformRef.current)
  }

  const scheduleTransform = (nextTransform) => {
    transformRef.current = nextTransform
    pendingTransformRef.current = nextTransform

    if (transformFrameRef.current === null) {
      transformFrameRef.current = requestAnimationFrame(commitTransform)
    }
  }

  useEffect(() => {
    const viewport = viewportRef.current
    const resizeObserver = new ResizeObserver(() => {
      const width = viewport.clientWidth
      const height = viewport.clientHeight
      const nextTransform = clampViewportTransform(
        transformRef.current,
        width,
        height,
      )

      setViewportSize({ width, height })
      scheduleTransform(nextTransform)
    })

    resizeObserver.observe(viewport)
    return () => {
      resizeObserver.disconnect()
      if (transformFrameRef.current !== null) {
        cancelAnimationFrame(transformFrameRef.current)
      }
    }
  }, [])

  const updateTransform = (nextTransform) => {
    const viewport = viewportRef.current
    if (!viewport) return

    scheduleTransform(clampViewportTransform(
      nextTransform,
      viewport.clientWidth,
      viewport.clientHeight,
    ))
  }

  const zoomAt = (nextScale, focalPoint) => {
    const current = transformRef.current
    const scale = clamp(nextScale, minScale, maxScale)
    const imageX = (focalPoint.x - current.x) / current.scale
    const imageY = (focalPoint.y - current.y) / current.scale

    updateTransform({
      x: focalPoint.x - imageX * scale,
      y: focalPoint.y - imageY * scale,
      scale,
    })
  }

  const zoomFromCenter = (amount) => {
    const viewport = viewportRef.current
    if (!viewport) return

    zoomAt(transformRef.current.scale + amount, {
      x: viewport.clientWidth / 2,
      y: viewport.clientHeight / 2,
    })
  }

  const startPinch = (gesture) => {
    const [first, second] = [...gesture.pointers.values()]
    const midpoint = getMidpoint(first, second)
    const current = transformRef.current

    gesture.mode = 'pinch'
    gesture.tapCandidate = null
    gesture.pinch = {
      distance: Math.max(getDistance(first, second), 1),
      scale: current.scale,
      imageX: (midpoint.x - current.x) / current.scale,
      imageY: (midpoint.y - current.y) / current.scale,
    }
  }

  const handlePointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const viewport = viewportRef.current
    const gesture = gestureRef.current
    const point = getPoint(event, viewport)
    viewport.setPointerCapture(event.pointerId)
    gesture.pointers.set(event.pointerId, point)

    if (gesture.pointers.size === 1) {
      gesture.mode = 'pan'
      gesture.isDragging = false
      gesture.lastPoint = point
      gesture.tapCandidate = {
        pointerId: event.pointerId,
        startPoint: point,
        moved: false,
      }
    }

    if (gesture.pointers.size >= 2) {
      startPinch(gesture)
    }
  }

  const handlePointerMove = (event) => {
    const viewport = viewportRef.current
    const gesture = gestureRef.current
    if (!gesture.pointers.has(event.pointerId)) return

    const point = getPoint(event, viewport)
    gesture.pointers.set(event.pointerId, point)

    if (
      gesture.tapCandidate?.pointerId === event.pointerId
      && getDistance(gesture.tapCandidate.startPoint, point) > TAP_MOVE_THRESHOLD
    ) {
      gesture.tapCandidate.moved = true
      gesture.isDragging = true
    }

    if (gesture.mode === 'pinch' && gesture.pointers.size >= 2) {
      const [first, second] = [...gesture.pointers.values()]
      const midpoint = getMidpoint(first, second)
      const distance = Math.max(getDistance(first, second), 1)
      const scale = clamp(
        gesture.pinch.scale * (distance / gesture.pinch.distance),
        minScale,
        maxScale,
      )

      updateTransform({
        x: midpoint.x - gesture.pinch.imageX * scale,
        y: midpoint.y - gesture.pinch.imageY * scale,
        scale,
      })
      return
    }

    if (
      gesture.mode === 'pan'
      && gesture.lastPoint
      && gesture.isDragging
    ) {
      const current = transformRef.current
      updateTransform({
        x: current.x + point.x - gesture.lastPoint.x,
        y: current.y + point.y - gesture.lastPoint.y,
        scale: current.scale,
      })
      gesture.lastPoint = point
    }
  }

  const handlePointerEnd = (event, isCancelled = false) => {
    const viewport = viewportRef.current
    const gesture = gestureRef.current
    const point = getPoint(event, viewport)

    if (
      gesture.tapCandidate?.pointerId === event.pointerId
      && getDistance(gesture.tapCandidate.startPoint, point) > TAP_MOVE_THRESHOLD
    ) {
      gesture.tapCandidate.moved = true
    }

    const isTap = !isCancelled
      && gesture.pointers.size === 1
      && gesture.mode === 'pan'
      && gesture.tapCandidate?.pointerId === event.pointerId
      && !gesture.tapCandidate.moved

    gesture.pointers.delete(event.pointerId)

    if (gesture.pointers.size >= 2) {
      startPinch(gesture)
    } else if (gesture.pointers.size === 1) {
      gesture.mode = 'pan'
      gesture.isDragging = true
      gesture.lastPoint = [...gesture.pointers.values()][0]
      gesture.tapCandidate = null
    } else {
      gesture.mode = null
      gesture.lastPoint = null
      gesture.pinch = null
      gesture.tapCandidate = null
      gesture.isDragging = false
    }

    if (isTap && !isProgressLoading) {
      const pieceInfo = getPieceInfoAtPoint({
        point,
        transform: transformRef.current,
        width: viewport.clientWidth,
        height: viewport.clientHeight,
        columns,
        rows,
      })

      if (pieceInfo !== undefined) {
        markPuzzlePerformance('piece-interaction-start', {
          pieceIndex: pieceInfo.pieceIndex,
          renderer: rendererMode,
        })
        onPieceTap?.(pieceInfo)
      }
    }
  }

  const handleWheel = (event) => {
    event.preventDefault()
    const viewport = viewportRef.current
    const point = getPoint(event, viewport)
    const scaleFactor = Math.exp(-event.deltaY * 0.0015)
    zoomAt(transformRef.current.scale * scaleFactor, point)
  }

  const handleMinimapClick = (event) => {
    const viewport = viewportRef.current
    const bounds = event.currentTarget.getBoundingClientRect()
    const normalizedX = (event.clientX - bounds.left) / bounds.width
    const normalizedY = (event.clientY - bounds.top) / bounds.height
    const current = transformRef.current

    updateTransform({
      x: viewport.clientWidth / 2
        - normalizedX * viewport.clientWidth * current.scale,
      y: viewport.clientHeight / 2
        - normalizedY * viewport.clientHeight * current.scale,
      scale: current.scale,
    })
  }

  const scalePercent = Math.round(transform.scale * 100)
  const minimapLeft = (
    -transform.x
    / (transform.scale || 1)
    / (viewportSize.width || 1)
  ) * 100
  const minimapTop = (
    -transform.y
    / (transform.scale || 1)
    / (viewportSize.height || 1)
  ) * 100
  const recentPiece = recentChange?.pieceIndex ?? null
  const recentColumn = recentPiece === null ? 0 : recentPiece % columns
  const recentRow = recentPiece === null ? 0 : Math.floor(recentPiece / columns)
  const changeClassName = recentChange?.isAcquired
    ? 'piece-change-flash piece-change-flash--acquired'
    : 'piece-change-flash piece-change-flash--released'
  const optimizedFlashStyle = recentPiece === null ? undefined : {
    left: transform.x
      + (recentColumn * viewportSize.width * transform.scale) / columns,
    top: transform.y
      + (recentRow * viewportSize.height * transform.scale) / rows,
    width: (viewportSize.width * transform.scale) / columns,
    height: (viewportSize.height * transform.scale) / rows,
  }

  const renderFlash = (isOptimized = false) => recentPiece !== null && (
    <span
      className={changeClassName}
      key={`${recentPiece}-${recentChange.sequence}-${rendererMode}`}
      style={isOptimized ? optimizedFlashStyle : {
        '--piece-column': recentColumn,
        '--piece-row': recentRow,
      }}
      aria-hidden="true"
    />
  )

  return (
    <div
      className="puzzle-explorer"
      style={{ '--puzzle-aspect-ratio': aspectRatio }}
    >
      <div
        ref={viewportRef}
        className="puzzle-viewport"
        onLostPointerCapture={(event) => handlePointerEnd(event, true)}
        onPointerCancel={(event) => handlePointerEnd(event, true)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onWheel={handleWheel}
        role="img"
        aria-busy={isProgressLoading}
        aria-label={`共 ${columns * rows} 块的活动拼图，已点亮 ${revealedCount} 块。可轻点切换拼图块状态、双指缩放并拖动画面。`}
      >
        {rendererMode === 'baseline' ? (
          <div
            className="puzzle-stage"
            style={{
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
            }}
          >
            <div
              className="puzzle-surface"
              style={{
                '--puzzle-columns': columns,
                '--puzzle-rows': rows,
              }}
            >
              <LegacyPuzzleCanvas
                columns={columns}
                rows={rows}
                imageUrl={imageUrl}
                aspectRatio={aspectRatio}
                canvasWidth={baselineCanvasWidth}
                canvasHeight={baselineCanvasHeight}
                changeLog={changeLog}
                changeRevision={changeRevision}
                snapshotRevision={snapshotRevision}
                pieceStates={pieceStates}
              />
              <div className="puzzle-grid" aria-hidden="true" />
              {renderFlash()}
            </div>
          </div>
        ) : (
          <div className="puzzle-surface puzzle-surface--optimized">
            <PuzzleCanvas
              columns={columns}
              rows={rows}
              imageUrl={imageUrl}
              aspectRatio={aspectRatio}
              viewportSize={viewportSize}
              transform={transform}
              changeLog={changeLog}
              changeRevision={changeRevision}
              snapshotRevision={snapshotRevision}
              pieceStates={pieceStates}
            />
            {renderFlash(true)}
          </div>
        )}
      </div>

      <div className="puzzle-minimap">
        <span>缩略图</span>
        <button
          className="minimap-image"
          onClick={handleMinimapClick}
          style={{ backgroundImage: `url(${imageUrl})` }}
          type="button"
          aria-label="在缩略图中定位画面"
        >
          <i
            style={{
              left: `${minimapLeft}%`,
              top: `${minimapTop}%`,
              width: `${100 / transform.scale}%`,
              height: `${100 / transform.scale}%`,
            }}
          />
        </button>
      </div>

      <div className="zoom-controls" aria-label="拼图缩放控制">
        <button
          onClick={() => zoomFromCenter(-0.5)}
          disabled={transform.scale <= minScale}
          type="button"
          aria-label="缩小拼图"
        >
          −
        </button>
        <button
          className="zoom-value"
          onClick={() => updateTransform(INITIAL_TRANSFORM)}
          type="button"
          aria-label={`当前缩放 ${scalePercent}%，点击还原`}
        >
          {scalePercent}%
        </button>
        <button
          onClick={() => zoomFromCenter(0.5)}
          disabled={transform.scale >= maxScale}
          type="button"
          aria-label="放大拼图"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default PuzzleViewport
