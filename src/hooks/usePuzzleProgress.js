import { useCallback, useRef, useState } from 'react'
import { createPiecePool } from '../utils/puzzle'

const createPuzzleState = (total) => ({
  total,
  completed: 0,
  order: new Uint32Array(total),
  pool: createPiecePool(total),
})

export const usePuzzleProgress = (total) => {
  const puzzleRef = useRef(null)

  if (!puzzleRef.current || puzzleRef.current.total !== total) {
    puzzleRef.current = createPuzzleState(total)
  }

  const [completed, setCompleted] = useState(0)

  const acquirePiece = useCallback(() => {
    const puzzle = puzzleRef.current
    const piece = puzzle.pool.take()

    if (piece === undefined) return undefined

    puzzle.order[puzzle.completed] = piece
    puzzle.completed += 1
    setCompleted(puzzle.completed)

    return piece
  }, [])

  return {
    acquirePiece,
    completed,
    pieceOrder: puzzleRef.current.order,
  }
}
