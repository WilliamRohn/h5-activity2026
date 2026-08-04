import { useEffect, useRef, useState } from 'react'
import { clamp, clampViewportTransform } from '../utils/puzzle'
import PuzzleCanvas from './PuzzleCanvas'

const INITIAL_TRANSFORM = { x: 0, y: 0, scale: 1 }

const getPoint = (event, element) => {
  const bounds = element.getBoundingClientRect()
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
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
  resolution,
  minScale,
  maxScale,
  pieceOrder,
  revealedCount,
  recentPiece,
}) {
  const viewportRef = useRef(null)
  const gestureRef = useRef({ pointers: new Map(), mode: null })
  const transformRef = useRef(INITIAL_TRANSFORM)
  const [transform, setTransform] = useState(INITIAL_TRANSFORM)

  useEffect(() => {
    const viewport = viewportRef.current
    const resizeObserver = new ResizeObserver(() => {
      const nextTransform = clampViewportTransform(
        transformRef.current,
        viewport.clientWidth,
        viewport.clientHeight,
      )
      transformRef.current = nextTransform
      setTransform(nextTransform)
    })

    resizeObserver.observe(viewport)
    return () => resizeObserver.disconnect()
  }, [])

  const updateTransform = (nextTransform) => {
    const viewport = viewportRef.current
    if (!viewport) return

    const clampedTransform = clampViewportTransform(
      nextTransform,
      viewport.clientWidth,
      viewport.clientHeight,
    )
    transformRef.current = clampedTransform
    setTransform(clampedTransform)
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

  const handlePointerDown = (event) => {
    const viewport = viewportRef.current
    const gesture = gestureRef.current
    const point = getPoint(event, viewport)
    viewport.setPointerCapture(event.pointerId)
    gesture.pointers.set(event.pointerId, point)

    if (gesture.pointers.size === 1) {
      gesture.mode = 'pan'
      gesture.lastPoint = point
    }

    if (gesture.pointers.size >= 2) {
      const [first, second] = [...gesture.pointers.values()]
      const midpoint = getMidpoint(first, second)
      const current = transformRef.current
      gesture.mode = 'pinch'
      gesture.pinch = {
        distance: Math.max(getDistance(first, second), 1),
        scale: current.scale,
        imageX: (midpoint.x - current.x) / current.scale,
        imageY: (midpoint.y - current.y) / current.scale,
      }
    }
  }

  const handlePointerMove = (event) => {
    const viewport = viewportRef.current
    const gesture = gestureRef.current
    if (!gesture.pointers.has(event.pointerId)) return

    const point = getPoint(event, viewport)
    gesture.pointers.set(event.pointerId, point)

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

    if (gesture.mode === 'pan' && gesture.lastPoint) {
      const current = transformRef.current
      updateTransform({
        x: current.x + point.x - gesture.lastPoint.x,
        y: current.y + point.y - gesture.lastPoint.y,
        scale: current.scale,
      })
      gesture.lastPoint = point
    }
  }

  const handlePointerEnd = (event) => {
    const gesture = gestureRef.current
    gesture.pointers.delete(event.pointerId)

    if (gesture.pointers.size === 1) {
      gesture.mode = 'pan'
      gesture.lastPoint = [...gesture.pointers.values()][0]
    } else if (gesture.pointers.size === 0) {
      gesture.mode = null
      gesture.lastPoint = null
      gesture.pinch = null
    }
  }

  const handleWheel = (event) => {
    event.preventDefault()
    const viewport = viewportRef.current
    const point = getPoint(event, viewport)
    const scaleFactor = Math.exp(-event.deltaY * 0.0015)
    zoomAt(transformRef.current.scale * scaleFactor, point)
  }

  const handleDoubleClick = (event) => {
    const viewport = viewportRef.current
    const nextScale = transformRef.current.scale > minScale ? minScale : 2.5
    zoomAt(nextScale, getPoint(event, viewport))
  }

  const handleMinimapClick = (event) => {
    const viewport = viewportRef.current
    const bounds = event.currentTarget.getBoundingClientRect()
    const normalizedX = (event.clientX - bounds.left) / bounds.width
    const normalizedY = (event.clientY - bounds.top) / bounds.height
    const current = transformRef.current

    updateTransform({
      x: viewport.clientWidth / 2 - normalizedX * viewport.clientWidth * current.scale,
      y: viewport.clientHeight / 2 - normalizedY * viewport.clientHeight * current.scale,
      scale: current.scale,
    })
  }

  const scalePercent = Math.round(transform.scale * 100)
  const minimapLeft = (-transform.x / (transform.scale || 1) / (viewportRef.current?.clientWidth || 1)) * 100
  const minimapTop = (-transform.y / (transform.scale || 1) / (viewportRef.current?.clientHeight || 1)) * 100

  return (
    <div className="puzzle-explorer">
      <div
        ref={viewportRef}
        className="puzzle-viewport"
        onDoubleClick={handleDoubleClick}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onWheel={handleWheel}
        role="img"
        aria-label={`共 ${columns * rows} 块的活动拼图，已点亮 ${revealedCount} 块。可双指缩放并拖动画面。`}
      >
        <div
          className="puzzle-stage"
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          }}
        >
          <PuzzleCanvas
            columns={columns}
            rows={rows}
            imageUrl={imageUrl}
            resolution={resolution}
            pieceOrder={pieceOrder}
            revealedCount={revealedCount}
            recentPiece={recentPiece}
          />
        </div>
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
