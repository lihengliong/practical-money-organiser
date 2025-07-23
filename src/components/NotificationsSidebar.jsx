import React, { useEffect } from 'react';
import './stylesheets/header.css';

const NotificationsSidebar = ({ show, onClose, notifications, onMarkRead, user, onClearAll }) => {
  useEffect(() => {
    if (show && onMarkRead) {
      onMarkRead();
    }
  }, [show, onMarkRead]);

  return (
    <>
      <div className={`notification-sidebar-overlay${show ? ' show' : ''}`} onClick={onClose} />
      <div className={`notification-sidebar${show ? ' show' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 18 }}>Notifications</div>
          {notifications && notifications.length > 0 && (
            <button className="clear-notifications-btn" onClick={onClearAll} style={{ fontSize: 13, padding: '4px 10px', borderRadius: 5, background: '#f44336', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Clear All
            </button>
          )}
        </div>
        <div className="notifications-list-sidebar">
          {notifications && notifications.length > 0 ? (
            notifications.map((n) => (
              <div key={n.id} className={`notification-item-sidebar${n.read ? '' : ' unread'}`}>
                <div style={{ fontSize: 15, marginBottom: 2 }}>{n.message}</div>
                <div className="noti-date">{n.createdAt && n.createdAt.toDate ? n.createdAt.toDate().toLocaleString() : ''}</div>
              </div>
            ))
          ) : (
            <div style={{ color: '#888', marginTop: 24 }}>No notifications yet.</div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationsSidebar; 