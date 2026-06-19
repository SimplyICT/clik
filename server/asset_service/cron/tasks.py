"""
Cron tasks for asset management — runs via APScheduler.
"""
import logging
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta

logger = logging.getLogger("simplyclik.asset_cron")

DB_CONFIG = None


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


def _compute_next_due(last_completed, frequency_type, frequency_value):
    if not last_completed:
        return None
    if frequency_type == "daily":
        return last_completed + timedelta(days=frequency_value)
    elif frequency_type == "weekly":
        return last_completed + timedelta(weeks=frequency_value)
    elif frequency_type == "monthly":
        return last_completed + relativedelta(months=frequency_value)
    elif frequency_type == "yearly":
        return last_completed + relativedelta(years=frequency_value)
    elif frequency_type == "hours_run":
        return None
    elif frequency_type == "meter_reading":
        return None
    return last_completed + timedelta(days=frequency_value)


def check_due_maintenance():
    logger.info("[st03] Checking due maintenance schedules...")
    now = datetime.now(timezone.utc)
    try:
        rows = db("""
            SELECT id, asset_id, title, frequency_type, frequency_value,
                   assigned_contractor_id, auto_create_work_order
            FROM asset_maintenance_schedules
            WHERE auto_create_work_order = TRUE
              AND next_due IS NOT NULL
              AND next_due <= NOW()
        """)
        count = 0
        for row in rows:
            schedule_id, asset_id, title, freq_type, freq_val, contractor_id, auto_wo = row
            wo_title = f"[Auto] {title} - {now.strftime('%Y-%m-%d')}"

            db("""
                INSERT INTO asset_work_orders
                    (asset_id, schedule_id, type, title, priority, status,
                     assigned_contractor_id, scheduled_date, created_at)
                VALUES (%s::uuid, %s::uuid, 'preventive', %s, 'medium', 'pending',
                        %s::uuid, %s::date, %s)
            """, (
                str(asset_id), str(schedule_id), wo_title,
                str(contractor_id) if contractor_id else None,
                now.strftime("%Y-%m-%d"), now,
            ))

            db("""
                INSERT INTO asset_audit_log (asset_id, event_type, actor_name, details, created_at)
                VALUES (%s::uuid, 'work_order_auto_created', 'system',
                        %s::jsonb, %s)
            """, (
                str(asset_id),
                '{"schedule_title": "' + title.replace("'", "''") + '", "source": "cron"}',
                now,
            ))

            last_completed = now
            next_due = _compute_next_due(last_completed, freq_type, freq_val)
            if next_due:
                db("""
                    UPDATE asset_maintenance_schedules
                    SET last_completed = %s, next_due = %s
                    WHERE id = %s::uuid
                """, (last_completed, next_due, str(schedule_id)))

            count += 1

        if count:
            logger.info("[st03] Auto-created %d work orders from due schedules", count)
    except Exception as e:
        logger.exception("[st03] Error: %s", e)
