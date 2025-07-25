import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import { useNavigate } from "react-router-dom";
import { NavLink } from 'react-router-dom';
import { useState, useEffect } from "react";
import './stylesheets/header.css';
import { MdNotificationsNone } from 'react-icons/md';
import NotificationsSidebar from './NotificationsSidebar';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';

const Header = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Listen for notifications for the logged-in user
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notifications'), where('user', '==', user.email));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifs.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
      setHasUnread(notifs.some(n => !n.read));
    });
    return () => unsubscribe();
  }, [user]);

  // Mark all notifications as read
  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
  };

  // Clear all notifications for the user
  const clearAllNotifications = async () => {
    await Promise.all(notifications.map(n => deleteDoc(doc(db, 'notifications', n.id))));
  };

  // Delete a single notification
  const deleteNotification = async (id) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error('Failed to delete notification', err);
    }
  };

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
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active header-hover-animate' : 'header-hover-animate')}>Dashboard</NavLink>
        <NavLink to="/friends" className={({ isActive }) => isActive ? 'active' : ''}>Friends</NavLink>
        <NavLink to="/groups" className={({ isActive }) => isActive ? 'active' : ''}>Groups</NavLink>
        {user && (
          <div className="user-section">
            <div className="header-user-info header-hover-animate" onClick={() => navigate('/profile')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="header-avatar header-avatar-initials">
                {(user.displayName ? user.displayName[0] : user.email[0]).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
                <span className="header-display-name" style={{ fontWeight: 700, fontSize: '1.13em', color: '#fff', marginBottom: 2 }}>{user.displayName || user.email.split('@')[0]}</span>
                <span className="header-email" style={{ fontSize: '0.98em', color: '#e0e7ff', opacity: 0.85 }}>{user.email}</span>
              </div>
            </div>
            {/* Bell icon button for notifications */}
            <button className="notification-bell-btn header-hover-animate" onClick={() => setShowSidebar(true)} style={{ background: 'none', border: 'none', marginLeft: '10px', cursor: 'pointer', position: 'relative' }}>
              <MdNotificationsNone size={24} />
              {hasUnread && <span className="notification-dot" />}
            </button>
            <button onClick={handleLogout} className="logout-btn">Log out</button>
          </div>
        )}
      </nav>
      <NotificationsSidebar
        show={showSidebar}
        onClose={() => setShowSidebar(false)}
        notifications={notifications}
        onMarkRead={markAllRead}
        user={user}
        onClearAll={clearAllNotifications}
        onDeleteNotification={deleteNotification}
      />
    </header>
  )
}

export default Header;