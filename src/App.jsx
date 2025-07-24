import './App.css'
import { Auth } from './components/auth'
import Friends from './pages/Friends'
import Groups from './pages/Groups'
import Activities from './pages/Activities'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile';
import GroupAnalytics from './pages/GroupAnalytics';
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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/group-analytics" element={<GroupAnalytics />} />
        </Route>
        <Route path="*" element={<div>404: Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;