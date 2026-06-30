"""
Database connection pool for SimplyClik.
Wraps pg8000 connections with a Queue-based pool.
PooledConnection proxies all attrs but overrides close() to return to pool.
"""
import pg8000
import logging
from queue import Queue, Empty, Full

logger = logging.getLogger("simplyclik.db_pool")


class PooledConnection:
    __slots__ = ("_conn", "_pool")

    def __init__(self, conn, pool):
        object.__setattr__(self, "_conn", conn)
        object.__setattr__(self, "_pool", pool)

    def __getattr__(self, name):
        conn = object.__getattribute__(self, "_conn")
        return getattr(conn, name)

    def __setattr__(self, name, value):
        conn = object.__getattribute__(self, "_conn")
        setattr(conn, name, value)

    def close(self):
        conn = object.__getattribute__(self, "_conn")
        if conn is None:
            return
        pool = object.__getattribute__(self, "_pool")
        object.__setattr__(self, "_conn", None)
        pool.put(conn)


class Pool:
    def __init__(self, factory, size=10):
        self._factory = factory
        self._pool = Queue(maxsize=size)
        self._size = size

    def get(self):
        try:
            conn = self._pool.get_nowait()
            try:
                cur = conn.cursor()
                cur.execute("SELECT 1")
                cur.close()
            except Exception:
                try: conn.close()
                except: pass
                conn = self._factory()
        except Empty:
            conn = self._factory()
        return PooledConnection(conn, self)

    def put(self, conn):
        if conn is None:
            return
        try:
            conn.rollback()
        except Exception:
            pass
        try:
            self._pool.put_nowait(conn)
        except Full:
            try:
                conn.close()
            except Exception:
                pass

    def close_all(self):
        while True:
            try:
                conn = self._pool.get_nowait()
                try:
                    conn.close()
                except Exception:
                    pass
            except Empty:
                break

    @property
    def qsize(self):
        return self._pool.qsize()

    def warm(self, count=None):
        """Pre-warm pool connections at startup."""
        import threading
        count = count or self._size
        created = 0
        for _ in range(count):
            try:
                conn = self._factory()
                self.put(conn)
                created += 1
            except Exception as e:
                logger.warning("Pool warm failed: %s", e)
        logger.info("Pool warmed with %d connections", created)
