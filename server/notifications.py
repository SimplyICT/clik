"""
SimplyClik Notification System — Email (SMTP), Push (FCM + Web Push), In-app.
"""
import os, smtplib, logging, json, base64
from email.mime.text import MIMEText
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger("simplyclik.notifications")

DB = None
FCM_APP = None
VAPID_PRIV = None
VAPID_PUB = None

# ── Config from env vars ──────────────────────────────────────────────────
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "noreply@simplyclik.com")
FCM_CRED_PATH = os.environ.get("FCM_CREDENTIALS", "")

# ── Pushover config ──────────────────────────────────────────────────────
PUSHOVER_TOKEN = os.environ.get("PUSHOVER_TOKEN", "")
PUSHOVER_USER = os.environ.get("PUSHOVER_USER", "")  # fallback global user key

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
def send_email(to: str, subject: str, body: str, html: str = None) -> bool:
    if not SMTP_HOST or not SMTP_USER:
        logger.warning("SMTP not configured, skipping email to %s", to)
        return False
    try:
        from email.mime.multipart import MIMEMultipart
        msg = MIMEMultipart('alternative') if html else MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to
        if html:
            part1 = MIMEText(body, "plain", "utf-8")
            part2 = MIMEText(html, "html", "utf-8")
            msg.attach(part1)
            msg.attach(part2)
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
# ── VAPID keys for Web Push ──────────────────────────────────────────────
def _init_vapid():
    global VAPID_PRIV, VAPID_PUB
    try:
        key_path = Path(__file__).resolve().parent / "vapid_private.pem"
        if key_path.exists():
            with open(key_path, "rb") as f:
                VAPID_PRIV = f.read()
            pub_path = Path(__file__).resolve().parent / "vapid_public.pem"
            with open(pub_path, "rb") as f:
                VAPID_PUB = f.read()
        else:
            private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
            VAPID_PRIV = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption())
            public_key = private_key.public_key()
            VAPID_PUB = public_key.public_bytes(
                encoding=serialization.Encoding.X962,
                format=serialization.PublicFormat.UncompressedPoint)
            with open(key_path, "wb") as f:
                f.write(VAPID_PRIV)
            pub_path = Path(__file__).resolve().parent / "vapid_public.pem"
            with open(pub_path, "wb") as f:
                f.write(VAPID_PUB)
        logger.info("VAPID keys ready")
    except Exception as e:
        logger.error("VAPID init failed: %s", e)

def get_vapid_public_key() -> str:
    if not VAPID_PUB:
        return ""
    return base64.urlsafe_b64encode(VAPID_PUB).rstrip(b"=").decode()

# ── Pushover (iOS/Android push notifications, no Firebase needed) ────────
PUSHOVER_API = "https://api.pushover.net/1/messages.json"

def send_pushover(title: str, body: str, url: str = "", url_title: str = "", user_key: str = None):
    """Send push notification via Pushover.
    Requires PUSHOVER_TOKEN in env. If user_key is provided, sends to that user;
    otherwise falls back to global PUSHOVER_USER.
    """
    if not PUSHOVER_TOKEN:
        logger.debug("Pushover not configured (no token)")
        return False
    key = user_key or PUSHOVER_USER
    if not key:
        logger.debug("Pushover not configured (no user key)")
        return False
    try:
        import urllib.request, urllib.parse
        data = urllib.parse.urlencode({
            "token": PUSHOVER_TOKEN,
            "user": key,
            "title": title[:250],
            "message": body[:1024],
            "url": url[:512] if url else "",
            "url_title": url_title[:100] if url_title else "",
            "sound": "pushover",
        }).encode()
        req = urllib.request.Request(PUSHOVER_API, data=data)
        resp = urllib.request.urlopen(req, timeout=10)
        logger.info("Pushover sent to user %s: %s", key[:8], title)
        return True
    except Exception as e:
        logger.error("Pushover failed: %s", e)
        return False

def send_web_push(subscription_info: dict, title: str, body: str):
    if not VAPID_PRIV:
        logger.warning("VAPID not initialized")
        return False
    try:
        from pywebpush import webpush
        payload = json.dumps({"title": title, "body": body, "icon": "/icon-192.svg"})
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=VAPID_PRIV.decode() if isinstance(VAPID_PRIV, bytes) else VAPID_PRIV,
            vapid_claims={"sub": "mailto:admin@simplyclik.local"},
        )
        return True
    except Exception as e:
        logger.error("Web push failed: %s", e)
        return False

def send_push(user_id: str, title: str, body: str, data: dict = None):
    """Try FCM first, fall back to web push for web platform tokens."""
    tokens = db("SELECT push_token, platform FROM device_tokens WHERE user_id = %s::uuid AND is_active = true", (user_id,))
    if not tokens:
        logger.debug("No device tokens for user %s", user_id)
        return False
    sent = 0
    for token_str, platform in tokens:
        try:
            if FCM_APP and platform != "web":
                from firebase_admin import messaging
                msg = messaging.Message(notification=messaging.Notification(title=title, body=body), token=token_str)
                messaging.send(msg)
                sent += 1
            elif VAPID_PRIV:
                sub = json.loads(token_str) if isinstance(token_str, str) else token_str
                send_web_push(sub, title, body)
                sent += 1
        except Exception as e:
            logger.error("Push failed for %s: %s", user_id, e)
    logger.info("Push sent to %d/%d devices for user %s", sent, len(tokens), user_id)
    return sent > 0

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
def get_pushover_key(user_id: str) -> str:
    """Look up a user's Pushover key from user_profiles."""
    rows = db("SELECT pushover_user_key FROM public.user_profiles WHERE user_id = %s::uuid", (user_id,))
    return rows[0][0] if rows and rows[0][0] else ""

def user_id_from_profile(profile_id: str) -> str:
    """Resolve a profile ID to a user ID."""
    rows = db("SELECT user_id FROM public.profiles WHERE id = %s::uuid", (profile_id,))
    return str(rows[0][0]) if rows else ""

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

    # Push notification (web push + FCM)
    if customer_id:
        users = db("""
            SELECT u.id FROM auth.users u
            JOIN public.user_profiles up ON up.user_id = u.id
            JOIN public.profiles p ON p.user_id = u.id
            WHERE p.customer_id = %s::uuid
        """, (customer_id,))
        for (uid,) in users:
            send_push(uid, f"Request {label}", f"'{title}' is now {label}")

    # Pushover (reliable iOS/Android push - per-user)
    contr_rows = db("SELECT \"contractorProfileId\" FROM requests WHERE id = %s::uuid", (request_id,))
    if contr_rows and contr_rows[0][0]:
        uid = user_id_from_profile(contr_rows[0][0])
        if uid:
            push_key = get_pushover_key(uid)
            if push_key:
                job_url = f"https://pwa.simplyclik.com/mobile/jobs/{request_id}"
                send_pushover(f"Request {label}", f"'{title}' - {customer_name}", job_url, "Open Job", user_key=push_key)

# ── Init ──────────────────────────────────────────────────────────────────
def init_notifications(db_config: dict):
    global DB
    DB = db_config
    _init_vapid()
    init_fcm()
    logger.info("Notification system initialized (SMTP=%s, FCM=%s, VAPID=%s, Pushover=%s)",
                bool(SMTP_HOST), bool(FCM_APP), bool(VAPID_PRIV), bool(PUSHOVER_TOKEN))
