import { useCallback, useRef, useState } from 'react'
import { createPiecePool } from '../utils/puzzle'

const createPuzzleState = (total) => ({
  total,
  completed: 0,
  changeLog: [],
  changeSequence: 0,
  pieceStates: new Uint8Array(total),
  pool: createPiecePool(total),
})

export const usePuzzleProgress = (total) => {
  const puzzleRef = useRef(null)

  if (!puzzleRef.current || puzzleRef.current.total !== total) {
    puzzleRef.current = createPuzzleState(total)
  }

  const [completed, setCompleted] = useState(0)
  const [changeRevision, setChangeRevision] = useState(0)
  const [snapshotRevision, setSnapshotRevision] = useState(0)
  const [lastChange, setLastChange] = useState(null)

  const hydrateAcquiredPieces = useCallback((litPieces, columns, rows) => {
    const nextPuzzle = createPuzzleState(total)
    let duplicateCount = 0
    let invalidCount = 0

    if (!Array.isArray(litPieces) || columns * rows !== total) {
      return {
        status: 'invalid',
        acquiredCount: 0,
        duplicateCount: 0,
        invalidCount: Array.isArray(litPieces) ? litPieces.length : 1,
      }
    }

    litPieces.forEach((piece) => {
      const column = piece?.x
      const row = piece?.y

      if (
        !Number.isInteger(column)
        || !Number.isInteger(row)
        || column < 0
        || column >= columns
        || row < 0
        || row >= rows
      ) {
        invalidCount += 1
        return
      }

      const pieceIndex = row * columns + column
      if (nextPuzzle.pieceStates[pieceIndex] === 1) {
        duplicateCount += 1
        return
      }

      nextPuzzle.pool.takeSpecific(pieceIndex)
      nextPuzzle.pieceStates[pieceIndex] = 1
      nextPuzzle.completed += 1
    })

    puzzleRef.current = nextPuzzle
    setCompleted(nextPuzzle.completed)
    setChangeRevision(0)
    setSnapshotRevision((revision) => revision + 1)
    setLastChange(null)

    return {
      status: 'hydrated',
      acquiredCount: nextPuzzle.completed,
      duplicateCount,
      invalidCount,
    }
  }, [total])

  const recordPieceState = useCallback((pieceIndex, isAcquired) => {
    const puzzle = puzzleRef.current
    puzzle.pieceStates[pieceIndex] = isAcquired ? 1 : 0
    puzzle.completed += isAcquired ? 1 : -1
    puzzle.changeSequence += 1

    const change = {
      pieceIndex,
      isAcquired,
      sequence: puzzle.changeSequence,
    }

    puzzle.changeLog.push(change)
    setCompleted(puzzle.completed)
    setChangeRevision(puzzle.changeSequence)
    setLastChange(change)

    return {
      status: isAcquired ? 'acquired' : 'released',
      pieceIndex,
      isAcquired,
    }
  }, [])

  const acquireRandomPiece = useCallback(() => {
    const puzzle = puzzleRef.current
    const pieceIndex = puzzle.pool.takeRandom()

    if (pieceIndex === undefined) {
      return { status: 'complete' }
    }

    return recordPieceState(pieceIndex, true)
  }, [recordPieceState])

  const setSpecificPieceState = useCallback((pieceIndex, isAcquired) => {
    const puzzle = puzzleRef.current

    if (
      !Number.isInteger(pieceIndex)
      || pieceIndex < 0
      || pieceIndex >= puzzle.total
      || typeof isAcquired !== 'boolean'
    ) {
      return { status: 'invalid' }
    }

    const currentState = puzzle.pieceStates[pieceIndex] === 1
    if (currentState === isAcquired) {
      return {
        status: 'unchanged',
        pieceIndex,
        isAcquired,
      }
    }

    if (isAcquired) {
      const acquiredPiece = puzzle.pool.takeSpecific(pieceIndex)
      if (acquiredPiece === undefined) return { status: 'invalid' }
      return recordPieceState(acquiredPiece, true)
    }

    const releasedPiece = puzzle.pool.restore(pieceIndex)
    if (releasedPiece === undefined) return { status: 'invalid' }
    return recordPieceState(releasedPiece, false)
  }, [recordPieceState])

  const toggleSpecificPiece = useCallback((pieceIndex) => {
    const puzzle = puzzleRef.current
    if (!Number.isInteger(pieceIndex) || pieceIndex < 0 || pieceIndex >= puzzle.total) {
      return { status: 'invalid' }
    }

    return setSpecificPieceState(
      pieceIndex,
      puzzle.pieceStates[pieceIndex] !== 1,
    )
  }, [setSpecificPieceState])

  const isPieceAcquired = useCallback((pieceIndex) => (
    Number.isInteger(pieceIndex)
      && pieceIndex >= 0
      && pieceIndex < puzzleRef.current.total
      && puzzleRef.current.pieceStates[pieceIndex] === 1
  ), [])

  return {
    acquireRandomPiece,
    changeLog: puzzleRef.current.changeLog,
    changeRevision,
    completed,
    hydrateAcquiredPieces,
    isPieceAcquired,
    lastChange,
    pieceStates: puzzleRef.current.pieceStates,
    setSpecificPieceState,
    snapshotRevision,
    toggleSpecificPiece,
  }
}
