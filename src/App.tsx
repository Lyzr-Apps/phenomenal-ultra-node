import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AgentInterceptorProvider } from '@/components/AgentInterceptorProvider'
import Home from './pages/Home'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <BrowserRouter>
      <AgentInterceptorProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AgentInterceptorProvider>
    </BrowserRouter>
  )
}
