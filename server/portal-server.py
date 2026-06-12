import sys, os, mimetypes, json, bcrypt, secrets, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(__file__))
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = Path(__file__).resolve().parent.parent
PORTAL_BUILD = ROOT / "web-portal" / "build"
PORT = int(os.environ.get("PORT", 3002))
ANON_KEY = 'sb_publishable_TNGKtfXYmjreJbzsTFZmQg_7DL977FT'
SUPABASE = 'https://imkkhzxeggjxepbisoyy.supabase.co'

DB = dict(host="db.imkkhzxeggjxepbisoyy.supabase.co", port=5432, database="postgres",
          user="postgres", password="LQ9aty9wUewIMYWF", ssl_context=True)

def dbq(sql, params=None):
    import pg8000
    conn = pg8000.connect(**DB); cur = conn.cursor()
    cur.execute(sql, params or []); rows = cur.fetchall()
    conn.commit(); cur.close(); conn.close()
    return rows

class Handler(SimpleHTTPRequestHandler):
    def _supabase_proxy(self, method):
        path = self.path.split('?')[0]
        qs = self.path.split('?')[1] if '?' in self.path else ''
        table = path.split('/api/supabase/', 1)[1]
        url = f"{SUPABASE}/rest/v1/{table}?{qs}" if qs else f"{SUPABASE}/rest/v1/{table}"
        headers = {'apikey': ANON_KEY, 'Content-Type': 'application/json'}
        try:
            if method in ('POST', 'PATCH'):
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length) if length else b''
                req = urllib.request.Request(url, data=body, headers=headers, method=method)
            elif method == 'DELETE':
                req = urllib.request.Request(url, headers=headers, method=method)
            else:
                req = urllib.request.Request(url, headers=headers)
            resp = urllib.request.urlopen(req, timeout=15)
            return self.respond(resp.status, resp.read(), 'application/json')
        except urllib.error.HTTPError as e:
            return self.respond(e.code, e.read(), 'application/json')
        except Exception as e:
            return self.json(500, {"error": str(e)})

    def do_POST(self):
        if self.path == '/api/login':
            length = int(self.headers['Content-Length'])
            body = json.loads(self.rfile.read(length))
            email = body.get('email', '').strip().lower()
            pw = body.get('password', '')
            if not email or not pw:
                return self.json(400, {"error": "Email and password required"})
            try:
                rows = dbq("SELECT id, email, encrypted_password FROM auth.users WHERE email=%s", (email,))
                if not rows or not bcrypt.checkpw(pw.encode(), rows[0][2].encode()):
                    return self.json(401, {"error": "Invalid credentials"})
                uid, db_email = rows[0][0], rows[0][1]
                
                profile = dbq("""
                    SELECT up.role, up.customer_ref, p.customer_id, p.id
                    FROM public.user_profiles up
                    LEFT JOIN public.profiles p ON p.user_id = up.user_id
                    WHERE up.user_id = %s LIMIT 1
                """, (uid,))
                customer_ref = profile[0][1] if profile else None
                customer_id = str(profile[0][2]) if profile and profile[0][2] else None
                author_profile_id = str(profile[0][3]) if profile and profile[0][3] else None
                
                customer_name = None
                if customer_id:
                    cust = dbq("SELECT name FROM public.customers WHERE id = %s", (customer_id,))
                    if cust:
                        customer_name = cust[0][0]
                
                token = secrets.token_hex(32)
                return self.json(200, {
                    "token": token,
                    "user": {"id": str(uid), "email": db_email, "uid": str(uid)},
                    "customer_ref": customer_ref,
                    "customer_id": customer_id,
                    "author_profile_id": author_profile_id,
                    "customer_name": customer_name
                })
            except Exception as e:
                return self.json(500, {"error": str(e)})
        if self.path.startswith('/api/supabase/'):
            return self._supabase_proxy('POST')
        self.json(404, {"error": "Not found"})

    def do_PATCH(self):
        if self.path.startswith('/api/supabase/'):
            return self._supabase_proxy('PATCH')
        self.send_error(404)

    def do_DELETE(self):
        if self.path.startswith('/api/supabase/'):
            return self._supabase_proxy('DELETE')
        self.send_error(404)

    def _serve_file(self):
        path = self.path.split('?')[0]
        qs = self.path.split('?')[1] if '?' in self.path else ''

        if path.startswith('/api/supabase/'):
            table = path.split('/api/supabase/')[1]
            url = f"{SUPABASE}/rest/v1/{table}?{qs}"
            req = urllib.request.Request(url, headers={'apikey': ANON_KEY})
            try:
                resp = urllib.request.urlopen(req, timeout=10)
                return self.respond(resp.status, resp.read(), 'application/json')
            except urllib.error.HTTPError as e:
                return self.respond(e.code, e.read(), 'application/json')

        if path.startswith('/api/'):
            return self.json(404, {"error": "Not found"})

        if path == '/': path = '/index.html'
        full = PORTAL_BUILD / path.lstrip('/')
        if full.exists() and full.is_file():
            ct = mimetypes.guess_type(str(full))[0] or 'application/octet-stream'
            self.send_response(200)
            self.send_header('Content-Type', ct)
            self.send_header('Content-Length', str(full.stat().st_size))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(full.read_bytes())
            return
        idx = PORTAL_BUILD / 'index.html'
        if idx.exists():
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.send_header('Content-Length', str(idx.stat().st_size))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(idx.read_bytes())
            return
        self.send_error(404)

    def do_GET(self):
        self._serve_file()

    def do_HEAD(self):
        self._serve_file()
 
    def respond(self, code, data, ct):
        self.send_response(code)
        self.send_header('Content-Type', ct)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        return self.wfile.write(data if isinstance(data, bytes) else data.encode())

    def json(self, s, d):
        data = json.dumps(d).encode()
        self.send_response(s)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(data)

if __name__ == '__main__':
    print(f"SimplyClik Portal on :{PORT}")
    HTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
