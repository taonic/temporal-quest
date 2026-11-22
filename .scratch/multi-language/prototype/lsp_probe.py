"""Prototype (ticket 02): how long a language server takes to answer a hover, and how much memory
its process tree holds then.

    python lsp_probe.py ROOT FILE SYMBOL -- SERVER_CMD...
"""

import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

root, rel, symbol = Path(sys.argv[1]).resolve(), sys.argv[2], sys.argv[3]
cmd = sys.argv[sys.argv.index("--") + 1:]
TIMEOUT = 300

# The server's stderr goes to a file beside the probe's output, for when it fails.
stderr = open(os.environ.get("LSP_STDERR", os.devnull), "w")
proc = subprocess.Popen(cmd, cwd=root, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=stderr)
responses: dict[int, dict] = {}
lock = threading.Condition()


def send(msg: dict) -> None:
    body = json.dumps(msg).encode()
    proc.stdin.write(f"Content-Length: {len(body)}\r\n\r\n".encode() + body)
    proc.stdin.flush()


def reader() -> None:
    while True:
        # Some servers print a line or two that isn't LSP before they start: skip to a header.
        headers = {}
        while True:
            line = proc.stdout.readline().decode(errors="replace")
            if line == "":
                return
            if line in ("\r\n", "\n") and "content-length" in headers:
                break
            k, sep, v = line.partition(":")
            if sep and k.strip().lower() in ("content-length", "content-type"):
                headers[k.strip().lower()] = v.strip()
        msg = json.loads(proc.stdout.read(int(headers["content-length"])))
        if "id" in msg and "method" in msg:  # a request from the server: answer it plainly
            result = [None] * len(msg.get("params", {}).get("items", [])) if msg["method"] == "workspace/configuration" else None
            send({"jsonrpc": "2.0", "id": msg["id"], "result": result})
        elif "id" in msg:
            with lock:
                responses[msg["id"]] = msg
                lock.notify_all()


def request(id_: int, method: str, params: dict, timeout: float) -> dict | None:
    send({"jsonrpc": "2.0", "id": id_, "method": method, "params": params})
    deadline = time.monotonic() + timeout
    with lock:
        while id_ not in responses:
            if not lock.wait(timeout=max(0.1, deadline - time.monotonic())) and time.monotonic() > deadline:
                return None
        return responses.pop(id_)


def tree_rss_mb(pid: int) -> int:
    rows = [r.split() for r in subprocess.run(["ps", "-eo", "pid=,ppid=,rss="], capture_output=True, text=True).stdout.splitlines()]
    kids: dict[str, list] = {}
    rss = {}
    for p, pp, r in rows:
        kids.setdefault(pp, []).append(p)
        rss[p] = int(r)
    total, stack = 0, [str(pid)]
    while stack:
        p = stack.pop()
        total += rss.get(p, 0)
        stack += kids.get(p, [])
    return total // 1024


threading.Thread(target=reader, daemon=True).start()
start = time.monotonic()
path = root / rel
text = path.read_text()
line_no = next(i for i, line in enumerate(text.splitlines()) if symbol in line)
char = text.splitlines()[line_no].index(symbol) + 1
uri = path.as_uri()
# LSP_INIT: JSON initializationOptions (typescript-language-server's maxTsServerMemory, say).
init = request(1, "initialize", {"processId": os.getpid(), "rootUri": root.as_uri(),
                                 "initializationOptions": json.loads(os.environ.get("LSP_INIT", "{}")),
                                 "workspaceFolders": [{"uri": root.as_uri(), "name": root.name}],
                                 "capabilities": {"textDocument": {"hover": {"contentFormat": ["markdown", "plaintext"]}}}}, TIMEOUT)
send({"jsonrpc": "2.0", "method": "initialized", "params": {}})
lang = {".ts": "typescript", ".java": "java", ".cs": "csharp"}[path.suffix]
send({"jsonrpc": "2.0", "method": "textDocument/didOpen",
      "params": {"textDocument": {"uri": uri, "languageId": lang, "version": 1, "text": text}}})
print(f"initialize: {time.monotonic() - start:.1f}s ({'ok' if init else 'no answer'})")

hover, id_ = None, 2
while time.monotonic() - start < TIMEOUT:
    resp = request(id_, "textDocument/hover", {"textDocument": {"uri": uri}, "position": {"line": line_no, "character": char}}, 30)
    id_ += 1
    if resp and resp.get("result") and resp["result"].get("contents"):
        hover = resp["result"]["contents"]
        break
    time.sleep(2)
elapsed = time.monotonic() - start
print(f"hover: {elapsed:.1f}s ({'answered' if hover else 'no answer'})")
print(f"hover text: {json.dumps(hover)[:300]}")
time.sleep(5)
print(f"tree RSS after hover: {tree_rss_mb(proc.pid)} MB", flush=True)
# LSP_HOLD: keep the server open that many seconds more (a check runs beside it), noting its size.
for _ in range(int(os.environ.get("LSP_HOLD", "0")) // 5):
    time.sleep(5)
    print(f"tree RSS: {tree_rss_mb(proc.pid)} MB", flush=True)
proc.kill()
