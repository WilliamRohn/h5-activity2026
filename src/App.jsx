import { useMemo, useState } from 'react'
import { Button, ProgressBar, Toast } from 'antd-mobile'
import { sample } from 'lodash-es'
import { PUZZLE_CONFIG } from './config/puzzle'
import './styles/app.css'

const ALL_PIECES = Array.from(
  { length: PUZZLE_CONFIG.columns * PUZZLE_CONFIG.rows },
  (_, index) => index,
)

const TAB_SIZE = 0.38
const TAB_START = (1 - TAB_SIZE) / 2
const TAB_OVERHANG = TAB_SIZE / 2

const getTabDirections = (row, column) => {
  if ((row + column) % 2 !== 0) return []

  return [
    column > 0 && 'left',
    column < PUZZLE_CONFIG.columns - 1 && 'right',
    row > 0 && 'top',
    row < PUZZLE_CONFIG.rows - 1 && 'bottom',
  ].filter(Boolean)
}

const getTabStyle = (direction, row, column) => {
  const positions = {
    left: [-TAB_OVERHANG, TAB_START],
    right: [1 - TAB_OVERHANG, TAB_START],
    top: [TAB_START, -TAB_OVERHANG],
    bottom: [TAB_START, 1 - TAB_OVERHANG],
  }
  const [localX, localY] = positions[direction]

  return {
    '--tab-bg-x': `${-((column + localX) / PUZZLE_CONFIG.columns) * 100}cqw`,
    '--tab-bg-y': `${-((row + localY) / PUZZLE_CONFIG.rows) * 100}cqh`,
  }
}

function PuzzleBoard({ acquiredPieces }) {
  const acquiredSet = useMemo(() => new Set(acquiredPieces), [acquiredPieces])

  return (
    <div
      className="puzzle-board"
      style={{
        '--puzzle-columns': PUZZLE_CONFIG.columns,
        '--puzzle-rows': PUZZLE_CONFIG.rows,
      }}
      aria-label={`共 ${ALL_PIECES.length} 块的活动拼图`}
    >
      {ALL_PIECES.map((pieceIndex) => {
        const column = pieceIndex % PUZZLE_CONFIG.columns
        const row = Math.floor(pieceIndex / PUZZLE_CONFIG.columns)
        const isAcquired = acquiredSet.has(pieceIndex)
        const tabDirections = getTabDirections(row, column)

        return (
          <div
            className={`puzzle-piece${isAcquired ? ' puzzle-piece--acquired' : ''}`}
            key={pieceIndex}
            style={{
              '--piece-layer': (row + column) % 2 === 0 ? 2 : 1,
              '--piece-image': `url(${PUZZLE_CONFIG.imageUrl})`,
              '--piece-bg-x': `${-(column / PUZZLE_CONFIG.columns) * 100}cqw`,
              '--piece-bg-y': `${-(row / PUZZLE_CONFIG.rows) * 100}cqh`,
            }}
            aria-label={`拼图第 ${pieceIndex + 1} 块，${isAcquired ? '已获得' : '未获得'}`}
          >
            {tabDirections.map((direction) => (
              <span
                aria-hidden="true"
                className={`piece-tab piece-tab--${direction}`}
                key={direction}
                style={getTabStyle(direction, row, column)}
              />
            ))}
            <span aria-hidden="true" className="piece-surface" />
            {!isAcquired && <span className="piece-dot" />}
          </div>
        )
      })}
    </div>
  )
}

function App() {
  const [acquiredPieces, setAcquiredPieces] = useState([])
  const total = ALL_PIECES.length
  const completed = acquiredPieces.length
  const progress = (completed / total) * 100
  const isComplete = completed === total

  const acquirePiece = () => {
    const acquiredSet = new Set(acquiredPieces)
    const remainingPieces = ALL_PIECES.filter((piece) => !acquiredSet.has(piece))
    const nextPiece = sample(remainingPieces)

    if (nextPiece === undefined) {
      Toast.show({ content: '拼图已经全部点亮啦' })
      return
    }

    setAcquiredPieces((current) => [...current, nextPiece])
    Toast.show({
      icon: 'success',
      content: `成功点亮第 ${nextPiece + 1} 块拼图`,
    })
  }

  return (
    <main className="page-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      <header className="hero-header">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">SUMMER COLLECTION · 2026</p>
        <h1>拾光拼图</h1>
        <p className="subtitle">每一次点亮，都是夏天留下的一小块回忆</p>
      </header>

      <section className="puzzle-card">
        <div className="card-heading">
          <div>
            <span className="section-number">01</span>
            <span className="section-title">我的夏日画卷</span>
          </div>
          <span className="piece-count">
            <strong>{completed}</strong> / {total}
          </span>
        </div>

        <PuzzleBoard acquiredPieces={acquiredPieces} />

        <div className="progress-row">
          <ProgressBar
            percent={progress}
            style={{ '--fill-color': '#ee6a45', '--track-color': '#e9e5dc', '--track-width': '0.06rem' }}
          />
          <span>{Math.round(progress)}%</span>
        </div>
      </section>

      <div className="hint-row">
        <i />
        <span>{isComplete ? '整幅画卷已被你点亮' : `还有 ${total - completed} 块拼图等待点亮`}</span>
        <i />
      </div>

      <div className="action-area">
        <Button
          block
          className="acquire-button"
          disabled={isComplete}
          onClick={acquirePiece}
        >
          <span className="button-spark">✦</span>
          {isComplete ? '已完成全部拼图' : '获取一块拼图'}
          <span className="button-arrow">→</span>
        </Button>
        <p>每次获取的拼图不会重复</p>
      </div>
    </main>
  )
}

export default App
