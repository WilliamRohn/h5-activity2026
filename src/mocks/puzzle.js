import { measurePuzzlePerformance } from '../utils/performance'

const createSeededRandom = (seed) => {
  let state = seed >>> 0

  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

const createMockPayload = ({ columns, rows, acquiredCount, seed }) => {
  const total = columns * rows
  const count = Math.min(Math.max(0, acquiredCount), total)
  const indices = new Uint32Array(total)
  const random = createSeededRandom(seed)

  for (let index = 0; index < total; index += 1) {
    indices[index] = index
  }

  for (let index = 0; index < count; index += 1) {
    const swapIndex = index + Math.floor(random() * (total - index))
    const value = indices[index]
    indices[index] = indices[swapIndex]
    indices[swapIndex] = value
  }

  return {
    columns,
    rows,
    litPieces: Array.from(indices.subarray(0, count), (pieceIndex) => ({
      x: pieceIndex % columns,
      y: Math.floor(pieceIndex / columns),
    })),
  }
}

export const fetchMockPuzzleProgress = ({
  columns,
  rows,
  acquiredCount,
  delay,
  seed,
}) => new Promise((resolve) => {
  setTimeout(() => {
    const startedAt = performance.now()
    const payload = createMockPayload({ columns, rows, acquiredCount, seed })
    const serialized = JSON.stringify(payload)
    const parsedPayload = JSON.parse(serialized)

    measurePuzzlePerformance('mock-generate-and-parse', startedAt, {
      bytes: serialized.length,
      count: parsedPayload.litPieces.length,
    })
    resolve(parsedPayload)
  }, delay)
})
