import './App.css'
import { Auth } from './components/auth'
import Friends from './pages/Friends'
import Groups from './pages/Groups'
import Activities from './pages/Activities'
import History from './pages/History'
import Notifications  from './pages/Notifications'
import Analytics from './pages/Analytics'
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
          <Route path="/history" element={<History />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/analytics" element={<Analytics />} />
        </Route>
        <Route path="*" element={<div>404: Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
    
  );
}

export default App;