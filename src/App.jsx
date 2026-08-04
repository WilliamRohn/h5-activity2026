import { useState } from 'react'
import { Button, ProgressBar, Toast } from 'antd-mobile'
import PuzzleViewport from './components/PuzzleViewport'
import { PUZZLE_CONFIG } from './config/puzzle'
import { usePuzzleProgress } from './hooks/usePuzzleProgress'
import './styles/app.css'

function App() {
  const total = PUZZLE_CONFIG.columns * PUZZLE_CONFIG.rows
  const { acquirePiece, completed, pieceOrder } = usePuzzleProgress(total)
  const [recentPiece, setRecentPiece] = useState(null)
  const progress = (completed / total) * 100
  const isComplete = completed === total
  const displayProgress = completed > 0 && progress < 1
    ? progress.toFixed(2)
    : Math.round(progress)

  const handleAcquirePiece = () => {
    const nextPiece = acquirePiece()

    if (nextPiece === undefined) {
      Toast.show({ content: '拼图已经全部点亮啦' })
      return
    }

    setRecentPiece(nextPiece)
    Toast.show({
      icon: 'success',
      content: `成功点亮第 ${nextPiece + 1} 块拼图`,
    })
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
            <span className="gesture-hint">双指缩放 · 拖动查看</span>
          </div>

          <PuzzleViewport
            columns={PUZZLE_CONFIG.columns}
            rows={PUZZLE_CONFIG.rows}
            imageUrl={PUZZLE_CONFIG.imageUrl}
            resolution={PUZZLE_CONFIG.canvasResolution}
            minScale={PUZZLE_CONFIG.minScale}
            maxScale={PUZZLE_CONFIG.maxScale}
            pieceOrder={pieceOrder}
            revealedCount={completed}
            recentPiece={recentPiece}
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
            disabled={isComplete}
            onClick={handleAcquirePiece}
          >
            <span className="button-spark">✦</span>
            {isComplete ? '已完成全部拼图' : '获取一块拼图'}
            <span className="button-arrow">→</span>
          </Button>
          <p>万级拼图由画布增量绘制，每次获取均不会重复</p>
        </div>
      </div>
    </main>
  )
}

export default App
