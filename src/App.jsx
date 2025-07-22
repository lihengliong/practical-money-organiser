import './App.css'
import { Auth } from './components/auth'
import Friends from './pages/Friends'
import Groups from './pages/Groups'
import Activities from './pages/Activities'
import Ledger from './pages/Ledger'
import Notifications  from './pages/Notifications'
import Analytics from './pages/Analytics'
import Profile from './pages/Profile';
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './layout'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route element={<Layout />}>
          <Route path="/friends" element={<Friends />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/activities/:groupId" element={<Activities />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<div>404: Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;