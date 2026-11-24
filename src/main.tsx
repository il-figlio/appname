import { createRoot } from 'react-dom/client'
import App from './App'
import Namespace from './Namespace'
import './styles.css'

const path = window.location.pathname.replace(/\/$/, '')
createRoot(document.getElementById('root')!).render(path === '/username' ? <Namespace mode="username" /> : path === '/domainname' ? <Namespace mode="domain" /> : <App />)
