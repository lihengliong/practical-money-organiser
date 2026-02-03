import React, { useEffect, useState } from 'react';
import './stylesheets/notifications-sidebar.css';

const NotificationsSidebar = ({ show, onClose, notifications, onMarkRead, onClearAll, onDeleteNotification }) => {
  const [removingIds, setRemovingIds] = useState([]);

  useEffect(() => {
    if (show && onMarkRead) {
      onMarkRead();
    }
  }, [show, onMarkRead]);

  const handleRemove = (id) => {
    setRemovingIds((prev) => [...prev, id]);
    setTimeout(() => {
      if (onDeleteNotification) onDeleteNotification(id);
    }, 300); // match CSS animation duration
  };

  return (
    <>
      <div className={`notification-sidebar-overlay${show ? ' show' : ''}`} onClick={onClose} />
      <div className={`notification-sidebar${show ? ' show' : ''}`}>
        <div className="notification-sidebar-header">
          <div className="notification-sidebar-title">Notifications</div>
          {notifications && notifications.length > 0 && (
            <button className="clear-notifications-btn" onClick={onClearAll} style={{ fontSize: 13, padding: '4px 10px', borderRadius: 5, background: '#f44336', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Clear All
            </button>
          )}
        </div>
        <div className="notifications-list-sidebar">
          {notifications && notifications.length > 0 ? (
            notifications.map((n) => (
              <div key={n.id} className={`notification-item-sidebar${n.read ? '' : ' unread'}${removingIds.includes(n.id) ? ' slide-out' : ''}`}>
                <button
                  className="notification-close-btn"
                  onClick={() => handleRemove(n.id)}
                  aria-label="Close notification"
                >
                  ×
                </button>
                <div className="notification-message">{n.message}</div>
                <div className="noti-date">{n.createdAt && n.createdAt.toDate ? n.createdAt.toDate().toLocaleString() : ''}</div>
              </div>
            ))
          ) : (
            <div className="no-notifications">No notifications yet.</div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationsSidebar; 