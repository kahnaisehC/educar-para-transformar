import { useEffect, useState } from "react";

import { apiRequest } from "../api";

import type { AppNotification } from "../types";

import { formatDateTime, getErrorMessage } from "../ui";

export function NotificationBell({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const result = await apiRequest<{ notifications: AppNotification[]; unreadCount: number }>(
        "/notifications",
        { token },
      );
      setNotifications(result.notifications);
      setUnread(result.unreadCount);
      setError(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(interval);
  }, [token]);

  async function markRead(notificationId: number) {
    try {
      await apiRequest(`/notifications/${notificationId}/read`, { method: "PATCH", token });
      await load();
    } catch {
      // keep the panel open; the next poll will refresh the state
    }
  }

  async function markAll() {
    try {
      await apiRequest("/notifications/read-all", { method: "PATCH", token });
      await load();
    } catch {
      // ignore refresh errors
    }
  }

  return (
    <div className="notification-wrap">
      <button
        className="notification-bell"
        type="button"
        title="Notificaciones"
        aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ""}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="bell-symbol">◉</span>
        {unread > 0 && <span className="notification-badge">{unread}</span>}
      </button>
      {open && (
        <div className="notification-panel">
          <div className="notification-header">
            <strong>Notificaciones</strong>
            {unread > 0 && (
              <button className="text-button" type="button" onClick={() => void markAll()}>
                Marcar todas como leídas
              </button>
            )}
          </div>
          {error && <p className="muted-note">{error}</p>}
          {notifications.length === 0 ? (
            <p className="muted-note notification-empty">Tenés las notificaciones al día.</p>
          ) : (
            <ul className="notification-list">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`notification-item ${notification.readAt ? "" : "notification-item-unread"}`}
                >
                  <button
                    className="notification-body"
                    type="button"
                    title={notification.readAt ? "Leída" : "Marcar como leída"}
                    onClick={() => void markRead(notification.id)}
                  >
                    <strong>{notification.title}</strong>
                    <span>{notification.body}</span>
                    <small>{formatDateTime(notification.createdAt)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
