import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './i18n'
import './styles/tokens.css'
import './styles/base.css'
import './styles/cards.css'
import './styles/lobby.css'
import './styles/table.css'
import './styles/trade.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
