import React from 'react'
import ReactDOM from 'react-dom/client'
import 'antd-mobile/es/global'
import App from './App'
import './styles/global.css'

const setRootFontSize = () => {
  const viewportWidth = Math.min(document.documentElement.clientWidth, 430)
  document.documentElement.style.fontSize = `${viewportWidth / 3.75}px`
}

setRootFontSize()
window.addEventListener('resize', setRootFontSize)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
