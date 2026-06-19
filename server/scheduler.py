"""
SimplyClik Scheduled Tasks — APScheduler jobs running alongside the FastAPI app.
"""
import logging
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger("simplyclik.scheduler")
scheduler = AsyncIOScheduler()

DB_CONFIG = None  # set by init_scheduler

def db(sql: str, params=None):
    import pg8000
    conn = pg8000.connect(**DB_CONFIG)
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

# ── st01: Auto-complete requests (12h cron) ──────────────────────────────
async def auto_complete_requests():
    logger.info("[st01] Running auto-complete check...")
    now = datetime.now(timezone.utc)
    try:
        rows = db("""
            SELECT r.id, ri.submit_date
            FROM requests r
            JOIN request_invoices ri ON ri.request_id = r.id
            WHERE r.status = 'contractor_completed'
        """)
        count = 0
        for req_id, submit_date in rows:
            if submit_date and (now - submit_date) > timedelta(hours=48):
                db("UPDATE requests SET status = %s WHERE id = %s", ("completed", req_id))
                count += 1
        if count:
            logger.info("[st01] Auto-completed %d requests", count)
    except Exception as e:
        logger.error("[st01] Error: %s", e)

# ── st02: Auto-reassign contractors (4h cron) ────────────────────────────
PRIORITY_TIMEOUTS = {
    "urgent": 6,
    "high": 12,
    "medium": 24,
    "low": 36,
    "none": 120,
}

async def auto_reassign_contractors():
    logger.info("[st02] Running auto-reassign check...")
    now = datetime.now(timezone.utc)
    try:
        rows = db("""
            SELECT r.id, r.priority, r."requestStartDate"
            FROM requests r
            WHERE r.status = 'awaiting_acceptance'
        """)
        count = 0
        for req_id, priority, start_date in rows:
            timeout_hours = PRIORITY_TIMEOUTS.get(priority, 120)
            if start_date and (now - start_date) > timedelta(hours=timeout_hours):
                db("UPDATE requests SET status = %s WHERE id = %s", ("awaiting_quote", req_id))
                count += 1
        if count:
            logger.info("[st02] Reassigned %d requests", count)
    except Exception as e:
        logger.error("[st02] Error: %s", e)

# ── Session cleanup ──────────────────────────────────────────────────────
async def cleanup_expired_sessions():
    try:
        db("DELETE FROM sessions WHERE expires_at < NOW()")
        logger.info("[cleanup] Expired sessions removed")
    except Exception as e:
        logger.error("[cleanup] Error: %s", e)

# ── Init ─────────────────────────────────────────────────────────────────
def init_scheduler(db_config: dict):
    global DB_CONFIG
    DB_CONFIG = db_config
    from asset_service.cron.tasks import DB_CONFIG as CRON_DB_CONFIG
    CRON_DB_CONFIG = db_config
    scheduler.add_job(auto_complete_requests, IntervalTrigger(hours=12), id="st01", replace_existing=True)
    scheduler.add_job(auto_reassign_contractors, IntervalTrigger(hours=4), id="st02", replace_existing=True)
    scheduler.add_job(cleanup_expired_sessions, IntervalTrigger(hours=1), id="session_cleanup", replace_existing=True)
    from asset_service.cron.tasks import check_due_maintenance
    scheduler.add_job(check_due_maintenance, IntervalTrigger(hours=1), id="st03", replace_existing=True)
    logger.info("Scheduler initialized with st01 (12h), st02 (4h), st03 (1h), session_cleanup (1h)")
