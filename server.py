#!/usr/bin/env python3
"""Local dev server for the workout calendar.

Serves the static frontend, including workouts.json which the page fetches
directly. Only GET is supported — any write attempt (POST/PUT/PATCH/DELETE)
is rejected so all data changes must happen by editing workouts.json
directly, never from the frontend.
"""
import http.server
import os

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

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
