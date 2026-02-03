import { Auth } from './components/Auth.jsx'
import Friends from './pages/Friends.jsx'
import Groups from './pages/Groups.jsx'
import GroupExpenses from './pages/Activities.jsx'
import GroupCreate from './pages/GroupCreate.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Profile from './pages/Profile.jsx';
import GroupAnalytics from './pages/GroupAnalytics.jsx';
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './Layout.jsx'
import { CurrencyProvider } from './contexts/CurrencyContext.jsx'

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