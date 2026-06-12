"""
SimplyClik Notification System — Email (SMTP), Push (FCM), In-app.
"""
import os, smtplib, logging, json
from email.mime.text import MIMEText
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("simplyclik.notifications")

DB = None  # set by init_notifications
FCM_APP = None

# ── Config from env vars ──────────────────────────────────────────────────
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "noreply@simplyclik.com")
FCM_CRED_PATH = os.environ.get("FCM_CREDENTIALS", "")

# ── DB helper ─────────────────────────────────────────────────────────────
def db(sql: str, params=None):
    import pg8000
    conn = pg8000.connect(**DB)
    cur = conn.cursor()
    cur.execute(sql, params or [])
    try:
        rows = cur.fetchall()
        conn.commit()
        return rows
    except:
        conn.commit()
        return []
    finally:
        cur.close()
        conn.close()

# ── ns01: Email (SMTP) ────────────────────────────────────────────────────
def send_email(to: str, subject: str, body: str) -> bool:
    if not SMTP_HOST or not SMTP_USER:
        logger.warning("SMTP not configured, skipping email to %s", to)
        return False
    try:
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as e:
        logger.error("Email failed to %s: %s", to, e)
        return False

def send_otp_email(to: str, code: str):
    send_email(to, "Your SimplyClik Verification Code", f"Your verification code is: {code}\n\nThis code expires in 15 minutes.")

def send_request_notification(to: str, title: str, status: str, request_id: str):
    send_email(to, f"Request Update: {title}", f"Your request '{title}' has been updated to: {status.replace('_', ' ').title()}\n\nView: http://208.87.135.84:3002/requests")

# ── ns02: Push notifications (FCM) ────────────────────────────────────────
def init_fcm():
    global FCM_APP
    if not FCM_CRED_PATH:
        logger.warning("FCM_CREDENTIALS not set, push notifications disabled")
        return
    try:
        import firebase_admin
        from firebase_admin import credentials
        cred_path = Path(FCM_CRED_PATH)
        if not cred_path.exists():
            logger.warning("FCM credentials file not found: %s", FCM_CRED_PATH)
            return
        cred = credentials.Certificate(str(cred_path))
        FCM_APP = firebase_admin.initialize_app(cred)
        logger.info("FCM initialized")
    except Exception as e:
        logger.error("FCM init failed: %s", e)

def send_push(user_id: str, title: str, body: str, data: dict = None):
    if not FCM_APP:
        logger.warning("FCM not initialized, skipping push to %s", user_id)
        return False
    try:
        from firebase_admin import messaging
        tokens = db("SELECT push_token FROM device_tokens WHERE user_id = %s::uuid AND is_active = true", (user_id,))
        if not tokens:
            logger.debug("No device tokens for user %s", user_id)
            return False
        for (token,) in tokens:
            msg = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data=data or {},
                token=token,
            )
            messaging.send(msg)
        logger.info("Push sent to %d devices for user %s", len(tokens), user_id)
        return True
    except Exception as e:
        logger.error("Push failed for %s: %s", user_id, e)
        return False

# ── ns03: In-app notifications ────────────────────────────────────────────
def create_inapp(user_id: str, title: str, body: str, link: str = None):
    db("""
        INSERT INTO notifications (user_id, title, body, link, is_read, created_at)
        VALUES (%s::uuid, %s, %s, %s, false, %s)
    """, (user_id, title, body, link, datetime.now(timezone.utc).isoformat()))

def get_inapp(user_id: str, limit: int = 50):
    rows = db("""
        SELECT id, title, body, link, is_read, created_at
        FROM notifications WHERE user_id = %s::uuid
        ORDER BY created_at DESC LIMIT %s
    """, (user_id, limit))
    return [{"id": str(r[0]), "title": r[1], "body": r[2], "link": r[3],
             "isRead": r[4], "createdAt": r[5].isoformat() if r[5] else None} for r in rows]

def mark_read(notification_id: str):
    db("UPDATE notifications SET is_read = true WHERE id = %s::uuid", (notification_id,))

# ── ns04: Trigger wiring ──────────────────────────────────────────────────
def notify_request_update(request_id: str, old_status: str, new_status: str, actor: dict):
    rows = db("SELECT title, \"customerId\", \"customerName\" FROM requests WHERE id = %s::uuid", (request_id,))
    if not rows:
        logger.warning("Request %s not found for notification", request_id)
        return
    title, customer_id, customer_name = rows[0]
    label = new_status.replace("_", " ").title()

    # Email to customer
    if customer_id:
        users = db("""
            SELECT u.email FROM auth.users u
            JOIN public.user_profiles up ON up.user_id = u.id
            JOIN public.profiles p ON p.user_id = u.id
            WHERE p.customer_id = %s::uuid AND up.role IN ('Manager','Operator')
        """, (customer_id,))
        for (email,) in users:
            send_request_notification(email, title, new_status, request_id)

    # In-app notification
    if customer_id:
        users = db("""
            SELECT u.id FROM auth.users u
            JOIN public.user_profiles up ON up.user_id = u.id
            WHERE up.customer_ref = (SELECT up2.customer_ref FROM public.user_profiles up2 WHERE up2.user_id = %s::uuid LIMIT 1)
        """, (customer_id,))
        for (uid,) in users:
            create_inapp(uid, f"Request {label}", f"'{title}' is now {label}", f"/requests/{request_id}")

    # Push notification
    if customer_id:
        users = db("""
            SELECT u.id FROM auth.users u
            JOIN public.user_profiles up ON up.user_id = u.id
            JOIN public.profiles p ON p.user_id = u.id
            WHERE p.customer_id = %s::uuid
        """, (customer_id,))
        for (uid,) in users:
            send_push(uid, f"Request {label}", f"'{title}' is now {label}")

# ── Init ──────────────────────────────────────────────────────────────────
def init_notifications(db_config: dict):
    global DB
    DB = db_config
    init_fcm()
    logger.info("Notification system initialized (SMTP=%s, FCM=%s)", bool(SMTP_HOST), bool(FCM_APP))
