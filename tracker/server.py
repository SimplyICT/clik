import json, os, uuid, re
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from datetime import datetime, timezone
import mimetypes

mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data.json"
PORT = int(os.environ.get("PORT", 3003))

def load_data():
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text())
    return {"projects": []}

def save_data(data):
    DATA_FILE.write_text(json.dumps(data, indent=2, default=str))

def make_id():
    return uuid.uuid4().hex[:12]

def now():
    return datetime.now(timezone.utc).isoformat()

def project_summary(p):
    tasks = p.get("tasks", [])
    total = len(tasks)
    done = sum(1 for t in tasks if t.get("status") == "done")
    progress = round(done / total * 100) if total else 0
    return {
        "id": p["id"],
        "name": p["name"],
        "description": p.get("description", ""),
        "total_tasks": total,
        "done_tasks": done,
        "progress": progress,
        "created_at": p.get("created_at", ""),
        "updated_at": p.get("updated_at", ""),
        "sort_order": p.get("sort_order", 0)
    }

def parse_query(path):
    parts = path.split("?", 1)
    params = {}
    if len(parts) > 1:
        for pair in parts[1].split("&"):
            if "=" in pair:
                k, v = pair.split("=", 1)
                params[k] = v
    return parts[0], params


class Handler(SimpleHTTPRequestHandler):

    def log_message(self, fmt, *args):
        print(f"[tracker] {args[0]}" if args else "")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path, params = parse_query(self.path)

        if path == "/api/projects":
            return self.list_projects()
        if path.startswith("/api/projects/") and path.endswith("/tasks"):
            pid = path.split("/")[3]
            return self.get_project(pid)
        if path.startswith("/api/projects/"):
            pid = path.split("/")[3] if len(path.split("/")) > 3 else None
            if pid:
                return self.get_project(pid)
            return self.json(400, {"error": "Missing project ID"})
        if path.startswith("/api/tasks/"):
            tid = path.split("/")[3]
            return self.get_task(tid)
        if path == "/api/events/stream":
            return self.event_stream()

        if path.startswith("/api/"):
            return self.json(404, {"error": "Not found"})

        clean = path.lstrip("/") or "index.html"
        full = ROOT / clean
        if full.exists() and full.is_file():
            self.send_response(200)
            ct = mimetypes.guess_type(str(full))[0] or "application/octet-stream"
            self.send_header("Content-Type", ct)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(full.read_bytes())
            return

        self.send_error(404)

    def do_POST(self):
        body = self.read_body()
        path, _ = parse_query(self.path)

        if path == "/api/projects":
            return self.create_project(body)
        if re.search(r"^/api/projects/[^/]+/tasks$", path):
            pid = path.split("/")[3]
            return self.add_task(pid, body)
        if path.startswith("/api/tasks/"):
            return self.update_task(path.split("/")[3], body)

        self.json(404, {"error": "Not found"})

    def do_PATCH(self):
        body = self.read_body()
        path, _ = parse_query(self.path)

        if path.startswith("/api/projects/"):
            pid = path.split("/")[3]
            return self.update_project(pid, body)
        if path.startswith("/api/tasks/"):
            tid = path.split("/")[3]
            return self.update_task(tid, body)

        self.json(404, {"error": "Not found"})

    def do_DELETE(self):
        path, _ = parse_query(self.path)
        if path.startswith("/api/projects/"):
            pid = path.split("/")[3]
            return self.delete_project(pid)
        if path.startswith("/api/tasks/"):
            tid = path.split("/")[3]
            return self.delete_task(tid)
        self.json(404, {"error": "Not found"})

    def read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length:
            return json.loads(self.rfile.read(length))
        return {}

    # ── Project handlers ──────────────────────────────────────────────

    def list_projects(self):
        data = load_data()
        items = [project_summary(p) for p in data.get("projects", [])]
        items.sort(key=lambda x: (x.get("sort_order", 0), x.get("name", "")))
        self.json(200, {"projects": items})

    def create_project(self, body):
        name = (body.get("name") or "").strip()
        if not name:
            return self.json(400, {"error": "Project name required"})
        data = load_data()
        p = {
            "id": make_id(),
            "name": name,
            "description": body.get("description", ""),
            "created_at": now(),
            "updated_at": now(),
            "sort_order": len(data["projects"]),
            "status_values": ["not_started", "in_progress", "blocked", "review", "done"],
            "tasks": []
        }
        data["projects"].append(p)
        save_data(data)
        self.json(201, {"project": p})

    def get_project(self, pid):
        data = load_data()
        for p in data["projects"]:
            if p["id"] == pid:
                return self.json(200, p)
        self.json(404, {"error": "Project not found"})

    def update_project(self, pid, body):
        data = load_data()
        for p in data["projects"]:
            if p["id"] == pid:
                if "name" in body:
                    p["name"] = body["name"].strip()
                if "description" in body:
                    p["description"] = body["description"]
                if "sort_order" in body:
                    p["sort_order"] = body["sort_order"]
                p["updated_at"] = now()
                save_data(data)
                return self.json(200, {"project": project_summary(p)})
        self.json(404, {"error": "Project not found"})

    def delete_project(self, pid):
        data = load_data()
        data["projects"] = [p for p in data["projects"] if p["id"] != pid]
        save_data(data)
        self.json(200, {"ok": True})

    # ── Task handlers ─────────────────────────────────────────────────

    def add_task(self, pid, body):
        title = (body.get("title") or "").strip()
        if not title:
            return self.json(400, {"error": "Task title required"})
        data = load_data()
        for p in data["projects"]:
            if p["id"] == pid:
                t = {
                    "id": make_id(),
                    "title": title,
                    "description": body.get("description", ""),
                    "status": "not_started",
                    "priority": body.get("priority", "medium"),
                    "owner": body.get("owner", ""),
                    "target_date": body.get("target_date", None),
                    "project_id": pid,
                    "subproject": body.get("subproject", None),
                    "phase": body.get("phase", None),
                    "dependencies": body.get("dependencies", []),
                    "proof": body.get("proof", []),
                    "notes": body.get("notes", ""),
                    "created_at": now(),
                    "updated_at": now()
                }
                p["tasks"].append(t)
                p["updated_at"] = now()
                save_data(data)
                return self.json(201, {"task": t})
        self.json(404, {"error": "Project not found"})

    def get_task(self, tid):
        data = load_data()
        for p in data["projects"]:
            for t in p["tasks"]:
                if t["id"] == tid:
                    return self.json(200, t)
        self.json(404, {"error": "Task not found"})

    def update_task(self, tid, body):
        data = load_data()
        for p in data["projects"]:
            for t in p["tasks"]:
                if t["id"] == tid:
                    for key in ["title", "description", "status", "priority", "owner",
                                "target_date", "subproject", "phase", "notes", "dependencies", "proof"]:
                        if key in body:
                            t[key] = body[key]
                    t["updated_at"] = now()
                    p["updated_at"] = now()
                    save_data(data)
                    return self.json(200, {"task": t})
        self.json(404, {"error": "Task not found"})

    def delete_task(self, tid):
        data = load_data()
        for p in data["projects"]:
            for i, t in enumerate(p["tasks"]):
                if t["id"] == tid:
                    p["tasks"].pop(i)
                    p["updated_at"] = now()
                    save_data(data)
                    return self.json(200, {"ok": True})
        self.json(404, {"error": "Task not found"})

    # ── SSE ───────────────────────────────────────────────────────────

    def event_stream(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(b"data: connected\n\n")
        self.wfile.flush()

    # ── Response helper ───────────────────────────────────────────────

    def json(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


if __name__ == "__main__":
    if not DATA_FILE.exists():
        save_data({"projects": []})
        print(f"  Created empty {DATA_FILE}")
    print(f"\n  SimplyClik Project Tracker")
    print(f"  URL: http://0.0.0.0:{PORT}")
    print()
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
