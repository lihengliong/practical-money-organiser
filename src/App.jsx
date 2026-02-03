import './App.css'
import { Auth } from './components/Auth'
import Friends from './pages/Friends'
import Groups from './pages/Groups'
import GroupExpenses from './pages/Activities'
import GroupCreate from './pages/GroupCreate'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile';
import GroupAnalytics from './pages/GroupAnalytics';
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './Layout'
import { CurrencyProvider } from './contexts/CurrencyContext'

function App() {
  return (
    <CurrencyProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route element={<Layout />}>
            <Route path="/friends" element={<Friends />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/groups/create" element={<GroupCreate />} />
            <Route path="/group-expenses/:groupId" element={<GroupExpenses />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/group-analytics" element={<GroupAnalytics />} />
          </Route>
          <Route path="*" element={<div>404: Page Not Found</div>} />
        </Routes>
      </BrowserRouter>
    </CurrencyProvider>
  );
}

export default App;