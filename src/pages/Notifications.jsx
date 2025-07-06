import React, { useEffect, useState } from 'react';
import { db, auth } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';

const Notifications = () => {
  const [user] = useAuthState(auth);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return;
      setLoading(true);
      const q = query(
        collection(db, 'notifications'),
        where('user', '==', user.email),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };
    fetchNotifications();
  }, [user]);

  if (!user) return <div>Please log in to view notifications.</div>;
  if (loading) return <div>Loading notifications...</div>;

  return (
    <div className="notifications-container">
      <h2>Notifications</h2>
      {notifications.length === 0 ? (
        <div>No notifications yet.</div>
      ) : (
        <ul className="notifications-list">
          {notifications.map(n => (
            <li key={n.id} className="notification-item">
              <div>{n.message}</div>
              <div style={{ fontSize: '0.9em', color: '#888' }}>
                {n.createdAt?.toDate?.() ? n.createdAt.toDate().toLocaleString() : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Notifications