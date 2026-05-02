from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Notification

router = APIRouter(prefix="/api/notifications", tags=["Notificações"])


@router.get("/{user_id}")
def get_notifications(user_id: str, db: Session = Depends(get_db)):
    """Retorna as últimas 30 notificações do usuário (lidas e não lidas)."""
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(30)
        .all()
    )
    return [
        {
            "id":         str(n.id),
            "type":       n.type,
            "message":    n.message,
            "read":       n.read,
            "event_id":   str(n.event_id) if n.event_id else None,
            "created_at": n.created_at.isoformat() + "Z",
        }
        for n in notifs
    ]


@router.get("/{user_id}/unread-count")
def get_unread_count(user_id: str, db: Session = Depends(get_db)):
    """Conta quantas notificações não lidas o usuário tem. Usado pelo badge do sino."""
    count = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.read == False
    ).count()
    return {"count": count}


@router.post("/{notification_id}/read")
def mark_as_read(notification_id: str, db: Session = Depends(get_db)):
    """Marca uma notificação como lida."""
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        notif.read = True
        db.commit()
    return {"ok": True}


@router.post("/{user_id}/read-all")
def mark_all_as_read(user_id: str, db: Session = Depends(get_db)):
    """Marca todas as notificações do usuário como lidas de uma vez."""
    db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.read == False
    ).update({"read": True})
    db.commit()
    return {"ok": True}
