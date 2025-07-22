import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import { useNavigate } from "react-router-dom";
import { NavLink } from 'react-router-dom';
import { useState, useEffect } from "react";
import './stylesheets/header.css';

const Header = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="navbar">
      <nav className="nav-links">
        <NavLink to="/friends" className={({ isActive }) => isActive ? 'active' : ''}>Friends</NavLink>
        <NavLink to="/groups" className={({ isActive }) => isActive ? 'active' : ''}>Groups</NavLink>
        <NavLink to="/ledger" className={({ isActive }) => isActive ? 'active' : ''}>Ledger</NavLink>
        <NavLink to="/notifications" className={({ isActive }) => isActive ? 'active' : ''}>Notifications</NavLink>
        <NavLink to="/analytics" className={({ isActive }) => isActive ? 'active' : ''}>Analytics</NavLink>
        {user && (
          <div className="user-section">
            <span className="user-email" style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/profile')}>
              {user.email}
            </span>
            <button onClick={handleLogout} className="logout-btn">Log out</button>
          </div>
        )}
      </nav>
    </header>
  )
}

export default Header;