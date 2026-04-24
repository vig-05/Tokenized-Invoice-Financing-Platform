import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import SMEDashboard from './pages/SMEDashboard'
import InvestorMarketplace from './pages/InvestorMarketplace'
import PortfolioDashboard from './pages/PortfolioDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sme" element={<SMEDashboard />} />
        <Route path="/invest" element={<InvestorMarketplace />} />
        <Route path="/portfolio" element={<PortfolioDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
