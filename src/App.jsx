import { useEffect, useRef, useState } from 'react'
import { Button, ProgressBar, Toast } from 'antd-mobile'
import PuzzleViewport from './components/PuzzleViewport'
import { PUZZLE_CONFIG } from './config/puzzle'
import { usePuzzleProgress } from './hooks/usePuzzleProgress'
import { fetchMockPuzzleProgress } from './mocks/puzzle'
import { createPuzzlePieceChangePayload } from './utils/puzzle'
import {
  getPuzzleRendererMode,
  initializePuzzlePerformance,
  markPuzzlePerformance,
  measurePuzzlePerformance,
} from './utils/performance'
import './styles/app.css'

function App({ onPuzzlePieceChange, onPuzzleProgressLoad }) {
  const total = PUZZLE_CONFIG.columns * PUZZLE_CONFIG.rows
  const {
    acquireRandomPiece,
    changeLog,
    changeRevision,
    completed,
    hydrateAcquiredPieces,
    isPieceAcquired,
    lastChange,
    pieceStates,
    setSpecificPieceState,
    snapshotRevision,
    toggleSpecificPiece,
  } = usePuzzleProgress(total)
  const pendingPiecesRef = useRef(new Set())
  const [progressLoadState, setProgressLoadState] = useState('loading')
  const [loadRevision, setLoadRevision] = useState(0)
  const rendererMode = getPuzzleRendererMode()
  const progress = (completed / total) * 100
  const isComplete = completed === total
  const displayProgress = completed > 0 && progress < 1
    ? progress.toFixed(2)
    : Math.round(progress)

  useEffect(() => initializePuzzlePerformance(rendererMode), [rendererMode])

  useEffect(() => {
    let isCancelled = false

    const loadProgress = async () => {
      setProgressLoadState('loading')
      const requestStartedAt = performance.now()
      markPuzzlePerformance('mock-request-start', { renderer: rendererMode })

      try {
        const response = onPuzzleProgressLoad
          ? await onPuzzleProgressLoad()
          : await fetchMockPuzzleProgress({
            columns: PUZZLE_CONFIG.columns,
            rows: PUZZLE_CONFIG.rows,
            acquiredCount: PUZZLE_CONFIG.mockAcquiredCount,
            delay: PUZZLE_CONFIG.mockDelay,
            seed: PUZZLE_CONFIG.mockSeed,
          })

        if (isCancelled) return
        measurePuzzlePerformance('mock-request-total', requestStartedAt, {
          count: response?.litPieces?.length ?? 0,
        })

        if (
          response?.columns !== PUZZLE_CONFIG.columns
          || response?.rows !== PUZZLE_CONFIG.rows
        ) {
          throw new Error('Puzzle dimensions do not match the configured grid')
        }

        const hydrationStartedAt = performance.now()
        const result = hydrateAcquiredPieces(
          response.litPieces,
          response.columns,
          response.rows,
        )
        measurePuzzlePerformance('hydrate-progress', hydrationStartedAt, result)

        if (result.status !== 'hydrated') {
          throw new Error('Puzzle progress is invalid')
        }

        markPuzzlePerformance('hydration-complete', result)
        setProgressLoadState('ready')
      } catch {
        if (isCancelled) return
        setProgressLoadState('error')
        Toast.show({ content: '拼图进度加载失败，请重试' })
      }
    }

    loadProgress()
    return () => {
      isCancelled = true
    }
  }, [hydrateAcquiredPieces, loadRevision, onPuzzleProgressLoad, rendererMode])

  const showAcquisitionResult = (result) => {
    if (result.status === 'acquired') {
      Toast.show({
        icon: 'success',
        content: `成功点亮第 ${result.pieceIndex + 1} 块拼图`,
      })
      return
    }

    if (result.status === 'released') {
      Toast.show({ content: `已取消第 ${result.pieceIndex + 1} 块拼图` })
      return
    }

    if (result.status === 'complete') {
      Toast.show({ content: '拼图已经全部点亮啦' })
      return
    }

    if (result.status === 'unchanged') {
      Toast.show({ content: '拼图状态未发生变化' })
      return
    }

    Toast.show({ content: '未找到对应的拼图块' })
  }

  const handleRandomAcquire = () => {
    if (progressLoadState === 'error') {
      setLoadRevision((revision) => revision + 1)
      return
    }

    showAcquisitionResult(acquireRandomPiece())
  }

  const handlePieceTap = async (pieceInfo) => {
    if (progressLoadState !== 'ready') return
    const { pieceIndex } = pieceInfo
    if (pendingPiecesRef.current.has(pieceIndex)) return

    const nextAcquiredState = !isPieceAcquired(pieceIndex)
    const payload = createPuzzlePieceChangePayload(pieceInfo, nextAcquiredState)

    if (!onPuzzlePieceChange) {
      showAcquisitionResult(toggleSpecificPiece(pieceIndex))
      return
    }

    pendingPiecesRef.current.add(pieceIndex)
    try {
      const serverResult = await onPuzzlePieceChange(payload)
      const authoritativeState = typeof serverResult?.isAcquired === 'boolean'
        ? serverResult.isAcquired
        : nextAcquiredState
      showAcquisitionResult(
        setSpecificPieceState(pieceIndex, authoritativeState),
      )
    } catch {
      Toast.show({ content: '拼图状态更新失败，请稍后重试' })
    } finally {
      pendingPiecesRef.current.delete(pieceIndex)
    }
  }

  return (
    <main className="page-shell">
      <div className="page-frame" aria-hidden="true" />
      <div className="page-content">
        <header className="hero-header">
          <div>
            <p className="eyebrow">CAMPUS MEMORY · 2026</p>
            <h1>拾光拼图</h1>
            <p className="subtitle">每一次点亮，都是校园时光的一小块回忆</p>
          </div>
          <div className="header-progress" aria-label={`已完成 ${completed} 块，共 ${total} 块`}>
            <strong>{completed.toLocaleString('zh-CN')}</strong>
            <span>/ {total.toLocaleString('zh-CN')}</span>
          </div>
        </header>

        <section className="puzzle-card">
          <div className="card-heading">
            <div>
              <span className="section-number">01</span>
              <span className="section-title">我的校园画卷</span>
            </div>
            <span className="gesture-hint">轻点切换 · 拖动查看 · 双指缩放</span>
          </div>

          <PuzzleViewport
            columns={PUZZLE_CONFIG.columns}
            rows={PUZZLE_CONFIG.rows}
            imageUrl={PUZZLE_CONFIG.imageUrl}
            aspectRatio={PUZZLE_CONFIG.aspectRatio}
            baselineCanvasWidth={PUZZLE_CONFIG.baselineCanvasWidth}
            baselineCanvasHeight={PUZZLE_CONFIG.baselineCanvasHeight}
            minScale={PUZZLE_CONFIG.minScale}
            maxScale={PUZZLE_CONFIG.maxScale}
            rendererMode={rendererMode}
            changeLog={changeLog}
            changeRevision={changeRevision}
            snapshotRevision={snapshotRevision}
            pieceStates={pieceStates}
            revealedCount={completed}
            recentChange={lastChange}
            isProgressLoading={progressLoadState !== 'ready'}
            onPieceTap={handlePieceTap}
          />

          <div className="progress-row">
            <ProgressBar
              percent={progress}
              style={{ '--fill-color': '#f2b923', '--track-color': '#eee6c9', '--track-width': '0.06rem' }}
            />
            <span>{displayProgress}%</span>
          </div>
        </section>

        <div className="hint-row">
          <i />
          <span>{isComplete ? '整幅画卷已被你点亮' : `还有 ${(total - completed).toLocaleString('zh-CN')} 块拼图等待点亮`}</span>
          <i />
        </div>

        <div className="action-area">
          <Button
            block
            className="acquire-button"
            disabled={progressLoadState === 'loading' || isComplete}
            onClick={handleRandomAcquire}
          >
            <span className="button-spark">✦</span>
            {progressLoadState === 'error'
              ? '重新加载拼图'
              : isComplete
                ? '已完成全部拼图'
                : '获取一块拼图'}
            <span className="button-arrow">→</span>
          </Button>
          <p>轻点拼图块可点亮，再次轻点可取消点亮</p>
        </div>
      </div>
    </main>
  )
}

export default App
