export const createPiecePool = (total, random = Math.random) => {
  const pieces = new Uint32Array(total)

  for (let index = 0; index < total; index += 1) {
    pieces[index] = index
  }

  let remaining = total

  return {
    take() {
      if (remaining === 0) return undefined

      const randomIndex = Math.floor(random() * remaining)
      const piece = pieces[randomIndex]
      remaining -= 1
      pieces[randomIndex] = pieces[remaining]
      pieces[remaining] = piece

      return piece
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
