const PERF_QUERY_KEY = 'perf'
const PERF_OUTPUT_ID = 'puzzle-performance-data'
let publishTimer

const canMeasure = () => (
  typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get(PERF_QUERY_KEY) === '1'
)

const getStore = () => {
  if (!canMeasure()) return null

  if (!window.__PUZZLE_PERF__) {
    window.__PUZZLE_PERF__ = {
      renderer: null,
      startedAt: performance.now(),
      marks: {},
      events: [],
      renders: [],
      interactions: [],
      frameIntervals: [],
      longTasks: [],
      ready: false,
    }
  }

  return window.__PUZZLE_PERF__
}

const publishStore = () => {
  if (publishTimer !== undefined || typeof document === 'undefined') return

  publishTimer = window.setTimeout(() => {
    publishTimer = undefined
    const store = window.__PUZZLE_PERF__
    if (!store) return

    let output = document.getElementById(PERF_OUTPUT_ID)
    if (!output) {
      output = document.createElement('output')
      output.id = PERF_OUTPUT_ID
      output.hidden = true
      document.body.append(output)
    }
    output.textContent = JSON.stringify(store)
  }, 50)
}

export const getPuzzleRendererMode = () => {
  if (typeof window === 'undefined') return 'optimized'
  return new URLSearchParams(window.location.search).get('renderer') === 'baseline'
    ? 'baseline'
    : 'optimized'
}

export const initializePuzzlePerformance = (renderer) => {
  if (!canMeasure()) return () => {}

  window.__PUZZLE_PERF__ = {
    renderer,
    startedAt: performance.now(),
    marks: {},
    events: [],
    renders: [],
    interactions: [],
    frameIntervals: [],
    longTasks: [],
    ready: false,
  }

  const store = getStore()
  publishStore()
  let observer

  if ('PerformanceObserver' in window) {
    try {
      observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          store.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
          })
          publishStore()
        })
      })
      observer.observe({ type: 'longtask', buffered: true })
    } catch {
      observer = undefined
    }
  }

  return () => observer?.disconnect()
}

export const markPuzzlePerformance = (name, details = {}) => {
  const store = getStore()
  if (!store) return

  const now = performance.now()
  store.marks[name] = now
  store.events.push({ name, at: now, details })
  publishStore()
}

export const measurePuzzlePerformance = (name, startedAt, details = {}) => {
  const store = getStore()
  if (!store) return undefined

  const start = typeof startedAt === 'number'
    ? startedAt
    : store.marks[startedAt]
  if (typeof start !== 'number') return undefined

  const duration = performance.now() - start
  store.events.push({ name, duration, details })
  publishStore()
  return duration
}

export const recordPuzzleRender = ({ duration, reason, renderer }) => {
  const store = getStore()
  if (!store) return

  store.renders.push({
    at: performance.now(),
    duration,
    reason,
    renderer,
  })
  publishStore()
}

export const recordPuzzleInteraction = ({ duration, pieceIndex, renderer }) => {
  const store = getStore()
  if (!store || typeof duration !== 'number') return

  store.interactions.push({
    at: performance.now(),
    duration,
    pieceIndex,
    renderer,
  })
  publishStore()
}

export const recordPuzzleFrame = (interval) => {
  const store = getStore()
  if (!store || interval <= 0 || interval > 1000) return
  store.frameIntervals.push(interval)
  publishStore()
}

export const markPuzzleReady = (details = {}) => {
  const store = getStore()
  if (!store || store.ready) return

  store.ready = true
  store.readyAt = performance.now()
  store.readyDetails = details
  measurePuzzlePerformance('hydration-to-first-canvas', 'hydration-complete', details)
  publishStore()
}
