import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import { useNavigate } from "react-router-dom";
import { Link } from 'react-router-dom';
import { useState, useEffect } from "react";
import './header-styles.css';

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
        <Link to="/friends">Friends</Link>
        <Link to="/groups">Groups</Link>
        <Link to="/activities">Activities</Link>
        <Link to="/notifications">Notifications</Link>
        <Link to="/analytics">Analytics</Link>
        {user && (
          <div className="user-section">
            <span className="user-email">{user.email}</span>
            <button onClick={handleLogout} className="logout-btn">Log out</button>
          </div>
        )}
      </nav>
    </header>
  )
}

export default Header;