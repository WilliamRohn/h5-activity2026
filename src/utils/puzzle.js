export const createPiecePool = (total, random = Math.random) => {
  const pieces = new Uint32Array(total)
  const positions = new Uint32Array(total)

  for (let index = 0; index < total; index += 1) {
    pieces[index] = index
    positions[index] = index
  }

  let remaining = total

  const takeAt = (position) => {
    const lastPosition = remaining - 1
    const piece = pieces[position]
    const lastPiece = pieces[lastPosition]

    remaining = lastPosition
    pieces[position] = lastPiece
    positions[lastPiece] = position
    pieces[lastPosition] = piece
    positions[piece] = lastPosition

    return piece
  }

  return {
    takeRandom() {
      if (remaining === 0) return undefined

      const randomIndex = Math.floor(random() * remaining)
      return takeAt(randomIndex)
    },
    takeSpecific(pieceIndex) {
      if (!Number.isInteger(pieceIndex) || pieceIndex < 0 || pieceIndex >= total) {
        return undefined
      }

      const position = positions[pieceIndex]
      if (position >= remaining || pieces[position] !== pieceIndex) {
        return undefined
      }

      return takeAt(position)
    },
    restore(pieceIndex) {
      if (!Number.isInteger(pieceIndex) || pieceIndex < 0 || pieceIndex >= total) {
        return undefined
      }

      const position = positions[pieceIndex]
      if (position < remaining && pieces[position] === pieceIndex) {
        return undefined
      }

      const firstAcquiredPosition = remaining
      const firstAcquiredPiece = pieces[firstAcquiredPosition]

      pieces[position] = firstAcquiredPiece
      positions[firstAcquiredPiece] = position
      pieces[firstAcquiredPosition] = pieceIndex
      positions[pieceIndex] = firstAcquiredPosition
      remaining += 1

      return pieceIndex
    },
    isRemaining(pieceIndex) {
      if (!Number.isInteger(pieceIndex) || pieceIndex < 0 || pieceIndex >= total) {
        return false
      }

      const position = positions[pieceIndex]
      return position < remaining && pieces[position] === pieceIndex
    },
    get remaining() {
      return remaining
    },
  }
}

export const clamp = (value, minimum, maximum) => (
  Math.min(maximum, Math.max(minimum, value))
)

export const clampViewportTransform = ({ x, y, scale }, width, height) => ({
  x: clamp(x, width * (1 - scale), 0),
  y: clamp(y, height * (1 - scale), 0),
  scale,
})

export const getCoverSourceRect = (imageWidth, imageHeight, targetAspectRatio) => {
  if (imageWidth <= 0 || imageHeight <= 0 || targetAspectRatio <= 0) {
    return undefined
  }

  const imageAspectRatio = imageWidth / imageHeight

  if (imageAspectRatio > targetAspectRatio) {
    const width = imageHeight * targetAspectRatio
    return {
      x: (imageWidth - width) / 2,
      y: 0,
      width,
      height: imageHeight,
    }
  }

  const height = imageWidth / targetAspectRatio
  return {
    x: 0,
    y: (imageHeight - height) / 2,
    width: imageWidth,
    height,
  }
}

export const getPieceInfoAtPoint = ({
  point,
  transform,
  width,
  height,
  columns,
  rows,
}) => {
  if (width <= 0 || height <= 0 || columns <= 0 || rows <= 0 || transform.scale <= 0) {
    return undefined
  }

  const boardX = (point.x - transform.x) / transform.scale
  const boardY = (point.y - transform.y) / transform.scale

  if (boardX < 0 || boardX >= width || boardY < 0 || boardY >= height) {
    return undefined
  }

  const column = Math.floor((boardX / width) * columns)
  const row = Math.floor((boardY / height) * rows)

  return {
    pieceIndex: row * columns + column,
    row,
    column,
    coordinates: {
      x: column,
      y: row,
    },
    boardPoint: {
      x: boardX,
      y: boardY,
      normalizedX: boardX / width,
      normalizedY: boardY / height,
    },
    viewportPoint: {
      x: point.x,
      y: point.y,
    },
    transform: { ...transform },
  }
}

export const getPieceIndexAtPoint = (options) => (
  getPieceInfoAtPoint(options)?.pieceIndex
)

export const createPuzzlePieceChangePayload = (pieceInfo, isAcquired) => ({
  action: isAcquired ? 'light' : 'unlight',
  isAcquired,
  pieceIndex: pieceInfo.pieceIndex,
  row: pieceInfo.row,
  column: pieceInfo.column,
  x: pieceInfo.coordinates.x,
  y: pieceInfo.coordinates.y,
})
