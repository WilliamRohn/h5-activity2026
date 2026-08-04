import { memo, useEffect, useRef, useState } from 'react'

const drawBaseImage = (canvas, image, resolution) => {
  canvas.width = resolution
  canvas.height = resolution

  const context = canvas.getContext('2d', { alpha: false })
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.filter = 'grayscale(1) brightness(1.2) contrast(0.56)'
  context.drawImage(image, 0, 0, resolution, resolution)
  context.filter = 'none'
  context.fillStyle = 'rgba(240, 241, 238, 0.78)'
  context.fillRect(0, 0, resolution, resolution)
}

const drawPiece = (canvas, image, pieceIndex, columns, rows) => {
  const context = canvas.getContext('2d', { alpha: false })
  const column = pieceIndex % columns
  const row = Math.floor(pieceIndex / columns)
  const sourceX = (column * image.naturalWidth) / columns
  const sourceY = (row * image.naturalHeight) / rows
  const sourceWidth = image.naturalWidth / columns
  const sourceHeight = image.naturalHeight / rows
  const destinationX = Math.floor((column * canvas.width) / columns)
  const destinationY = Math.floor((row * canvas.height) / rows)
  const destinationRight = Math.ceil(((column + 1) * canvas.width) / columns)
  const destinationBottom = Math.ceil(((row + 1) * canvas.height) / rows)

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    destinationX,
    destinationY,
    destinationRight - destinationX,
    destinationBottom - destinationY,
  )
}

function PuzzleCanvas({
  columns,
  rows,
  imageUrl,
  resolution,
  pieceOrder,
  revealedCount,
  recentPiece,
}) {
  const canvasRef = useRef(null)
  const imageRef = useRef(null)
  const renderedCountRef = useRef(0)
  const latestPuzzleRef = useRef({ pieceOrder, revealedCount })
  const [loadState, setLoadState] = useState('loading')

  latestPuzzleRef.current = { pieceOrder, revealedCount }

  useEffect(() => {
    let isCancelled = false
    const image = new Image()
    image.decoding = 'async'

    setLoadState('loading')
    image.onload = () => {
      if (isCancelled) return

      const canvas = canvasRef.current
      const currentPuzzle = latestPuzzleRef.current
      imageRef.current = image
      drawBaseImage(canvas, image, resolution)

      for (let index = 0; index < currentPuzzle.revealedCount; index += 1) {
        drawPiece(canvas, image, currentPuzzle.pieceOrder[index], columns, rows)
      }

      renderedCountRef.current = currentPuzzle.revealedCount
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
  }, [columns, imageUrl, resolution, rows])

  useEffect(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image || loadState !== 'ready') return

    if (revealedCount < renderedCountRef.current) {
      drawBaseImage(canvas, image, resolution)
      renderedCountRef.current = 0
    }

    for (let index = renderedCountRef.current; index < revealedCount; index += 1) {
      drawPiece(canvas, image, pieceOrder[index], columns, rows)
    }

    renderedCountRef.current = revealedCount
  }, [columns, loadState, pieceOrder, resolution, revealedCount, rows])

  const recentColumn = recentPiece === null ? 0 : recentPiece % columns
  const recentRow = recentPiece === null ? 0 : Math.floor(recentPiece / columns)

  return (
    <div
      className="puzzle-surface"
      style={{
        '--puzzle-columns': columns,
        '--puzzle-rows': rows,
      }}
    >
      <canvas ref={canvasRef} className="puzzle-canvas" />
      <div className="puzzle-grid" aria-hidden="true" />
      {recentPiece !== null && (
        <span
          className="piece-reveal-flash"
          key={`${recentPiece}-${revealedCount}`}
          style={{
            '--piece-column': recentColumn,
            '--piece-row': recentRow,
          }}
          aria-hidden="true"
        />
      )}
      {loadState !== 'ready' && (
        <div className="puzzle-loading" role="status">
          {loadState === 'error' ? '拼图图片加载失败' : '正在展开画卷…'}
        </div>
      )}
    </div>
  )
}

export default memo(PuzzleCanvas)
