#!/usr/bin/env python3
"""Backend for the workout calendar.

Serves the static frontend and a read-only /api/workouts endpoint backed by
workouts.json. Only GET is supported — any write attempt (POST/PUT/PATCH/
DELETE) is rejected so all data changes must happen on the backend/file
directly, never from the frontend.
"""
import http.server
import os

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
WORKOUTS_FILE = os.path.join(DIRECTORY, "workouts.json")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path == "/api/workouts":
            self.send_workouts()
            return
        super().do_GET()

    def send_workouts(self):
        try:
            with open(WORKOUTS_FILE, "rb") as f:
                body = f.read()
        except FileNotFoundError:
            body = b"[]"
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def reject_write(self):
        self.send_error(405, "Writes are not allowed from the frontend")

    do_POST = reject_write
    do_PUT = reject_write
    do_PATCH = reject_write
    do_DELETE = reject_write


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("", PORT), Handler) as httpd:
        print(f"Serving on http://localhost:{PORT}")
        httpd.serve_forever()
