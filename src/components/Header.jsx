import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase.js";
import { useNavigate } from "react-router-dom";
import { NavLink } from 'react-router-dom';
import { useState, useEffect } from "react";
import { MdNotificationsNone, MdMenu, MdClose } from 'react-icons/md';
import NotificationsSidebar from './NotificationsSidebar.jsx';
import CurrencySelector from './CurrencySelector.jsx';
import { db } from '../config/firebase.js';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';

const Header = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

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

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
  };

  const clearAllNotifications = async () => {
    await Promise.all(notifications.map(n => deleteDoc(doc(db, 'notifications', n.id))));
  };

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

  const navLinkClass = ({ isActive }) =>
    `text-white no-underline font-semibold text-lg py-3 px-6 rounded-full transition-all duration-300
     relative overflow-hidden hover:bg-white/15 hover:-translate-y-0.5 hover:shadow-lg hover:border hover:border-emerald-400/80
     ${isActive ? 'bg-white !text-emerald-600 font-bold border-2 border-emerald-500 shadow-md z-[2]' : ''}`;

  return (
    <header className="bg-gradient-to-br from-emerald-500 to-teal-500 py-4 px-8 shadow-lg w-full md:px-4 max-sm:px-4">
      <nav className="flex justify-between items-center max-w-[1200px] mx-auto w-full">

        {/* Desktop nav links — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-4">
          <NavLink to="/dashboard" className={navLinkClass}>Dashboard</NavLink>
          <NavLink to="/friends" className={navLinkClass}>Friends</NavLink>
          <NavLink to="/groups" className={navLinkClass}>Groups</NavLink>
        </div>

        {/* Mobile: app name / logo placeholder */}
        <span className="sm:hidden text-white font-bold text-xl tracking-tight">PMO</span>

        {user && (
          <div className="flex items-center gap-3 ml-auto">
            {/* Currency Selector — desktop only */}
            <div className="hidden sm:block">
              <CurrencySelector className="!mb-0" id="header-currency-select" label="Currency:" />
            </div>

            {/* User avatar — navigates to profile */}
            <div
              className="flex items-center gap-3 rounded-2xl cursor-pointer
                         transition-all duration-200 hover:scale-[1.035] hover:-translate-y-0.5
                         hover:shadow-lg hover:bg-white/10 px-1"
              onClick={() => navigate('/profile')}
            >
              <div className="w-11 h-11 rounded-full bg-indigo-100 text-slate-700 flex items-center justify-center
                              text-xl font-bold border-2 border-white shadow-md uppercase">
                {(user.displayName ? user.displayName[0] : user.email[0]).toUpperCase()}
              </div>
              {/* Hide name/email on mobile */}
              <div className="hidden sm:flex flex-col items-start leading-none">
                <span className="font-bold text-lg text-white mb-0.5">
                  {user.displayName || user.email.split('@')[0]}
                </span>
                <span className="text-sm text-indigo-100 opacity-85">{user.email}</span>
              </div>
            </div>

            {/* Notification bell */}
            <button
              className="bg-transparent border-none cursor-pointer relative text-white
                         transition-all duration-200 hover:scale-110"
              onClick={() => setShowSidebar(true)}
            >
              <MdNotificationsNone size={26} />
              {hasUnread && (
                <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-white rounded-full
                                 border-2 border-blue-500 shadow-sm z-[2]" />
              )}
            </button>

            {/* Desktop logout button */}
            <button
              onClick={handleLogout}
              className="hidden sm:block bg-white/20 text-white border-none py-2 px-4 rounded-full font-semibold
                         cursor-pointer transition-all duration-300
                         hover:bg-white/30 hover:-translate-y-px"
            >
              Log out
            </button>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden bg-transparent border-none cursor-pointer text-white
                         transition-all duration-200 hover:scale-110"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <MdClose size={28} /> : <MdMenu size={28} />}
            </button>
          </div>
        )}
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="sm:hidden mt-3 border-t border-white/30 pt-4 flex flex-col gap-2 animate-fade-in">
          <NavLink to="/dashboard" className={navLinkClass} onClick={() => setMenuOpen(false)}>Dashboard</NavLink>
          <NavLink to="/friends"   className={navLinkClass} onClick={() => setMenuOpen(false)}>Friends</NavLink>
          <NavLink to="/groups"    className={navLinkClass} onClick={() => setMenuOpen(false)}>Groups</NavLink>
          <div className="mt-2 pt-3 border-t border-white/20 flex items-center justify-between gap-3">
            <CurrencySelector className="!mb-0" id="mobile-currency-select" label="Currency:" />
            <button
              onClick={() => { setMenuOpen(false); handleLogout(); }}
              className="bg-white/20 text-white border-none py-2 px-4 rounded-full font-semibold
                         cursor-pointer transition-all duration-300 hover:bg-white/30"
            >
              Log out
            </button>
          </div>
        </div>
      )}

      <NotificationsSidebar
        show={showSidebar}
        onClose={() => setShowSidebar(false)}
        notifications={notifications}
        onMarkRead={markAllRead}
        onClearAll={clearAllNotifications}
        onDeleteNotification={deleteNotification}
      />
    </header>
  );
};

export default Header;
