import { useEffect, useState } from 'react';

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
    }, 300);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/15 z-[1000] transition-opacity duration-200
                    ${show ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 right-0 w-[340px] max-w-full h-screen bg-white
                    shadow-[-2px_0_16px_rgba(0,0,0,0.12)] z-[1001] px-5 pt-6 flex flex-col
                    transition-transform duration-300
                    ${show ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-lg">Notifications</div>
          {notifications && notifications.length > 0 && (
            <button
              className="text-[13px] px-2.5 py-1 rounded bg-red-500 text-white border-none cursor-pointer
                         hover:bg-red-600 transition-colors"
              onClick={onClearAll}
            >
              Clear All
            </button>
          )}
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto pb-6">
          {notifications && notifications.length > 0 ? (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`relative rounded-lg mb-4 py-4 pl-4 pr-9 shadow-sm transition-all duration-300
                            ${n.read ? 'bg-gray-100' : 'bg-blue-50'}
                            ${removingIds.includes(n.id) ? 'translate-x-[120%] opacity-0' : 'opacity-100'}`}
              >
                <button
                  className="absolute top-2 right-2 bg-transparent border-none text-base cursor-pointer text-gray-500 z-[2]
                             hover:text-gray-700"
                  onClick={() => handleRemove(n.id)}
                  aria-label="Close notification"
                >
                  ×
                </button>
                <div className="text-[15px] mb-0.5">{n.message}</div>
                <div className="text-gray-500 text-xs mt-1 tracking-wide">
                  {n.createdAt && n.createdAt.toDate ? n.createdAt.toDate().toLocaleString() : ''}
                </div>
              </div>
            ))
          ) : (
            <div className="text-gray-500 mt-6">No notifications yet.</div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationsSidebar;
