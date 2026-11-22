"""A language server over a WebSocket: any one that speaks LSP on stdio.

lsp_bridge.py is Python's, with jedi's extras; this is every other language's (TypeScript's
typescript-language-server, in its snapshot). Each connection gets its own server, so two browser
tabs don't share one server's state, and closing a tab ends its server. Messages go across as
WebSocket text frames, one JSON-RPC message each, as @codemirror/lsp-client sends them; the server
gets the usual Content-Length framing. --init merges JSON into the client's initialize request's
initializationOptions (TypeScript's tsserver memory cap).

Runs from /opt/lsp, beside lsp_bridge.py, started by the course runner:

    /opt/lsp/bin/python /opt/lsp/lsp_stdio_bridge.py --port 2088 --cwd /workshop/langs/typescript/hello \\
        --init '{"maxTsServerMemory": 512}' -- typescript-language-server --stdio
"""

import argparse
import asyncio
import json

from websockets.asyncio.server import serve


async def messages(stdout):
    while True:
        length = None
        while True:
            line = await stdout.readline()
            if not line:
                return
            line = line.strip()
            if not line:
                break
            name, _, value = line.decode("ascii", "replace").partition(":")
            if name.lower() == "content-length":
                length = int(value)
        if length is not None:
            yield await stdout.readexactly(length)


def with_init(message: str, init: dict) -> str:
    """The client's initialize request, with `init` in its initializationOptions."""
    if not init or '"initialize"' not in message:
        return message
    request = json.loads(message)
    if request.get("method") != "initialize":
        return message
    params = request.setdefault("params", {})
    params["initializationOptions"] = {**(params.get("initializationOptions") or {}), **init}
    return json.dumps(request)


async def session(ws, command, cwd, init):
    pipe, quiet = asyncio.subprocess.PIPE, asyncio.subprocess.DEVNULL
    proc = await asyncio.create_subprocess_exec(*command, stdin=pipe, stdout=pipe, stderr=quiet, cwd=cwd)

    async def to_client():
        async for body in messages(proc.stdout):
            await ws.send(body.decode("utf-8"))

    async def to_server():
        async for message in ws:
            text = message if isinstance(message, str) else message.decode("utf-8")
            data = with_init(text, init).encode("utf-8")
            proc.stdin.write(b"Content-Length: %d\r\n\r\n" % len(data) + data)
            await proc.stdin.drain()

    tasks = [asyncio.create_task(to_client()), asyncio.create_task(to_server())]
    try:
        await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    finally:
        for task in tasks:
            task.cancel()
        if proc.returncode is None:
            proc.kill()
        await proc.wait()


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--cwd", default="/workshop")
    parser.add_argument("--init", default="{}", help="JSON merged into initialize's initializationOptions")
    parser.add_argument("command", nargs=argparse.REMAINDER, help="-- the server's command")
    args = parser.parse_args()
    command = [c for c in args.command if c != "--"]
    init = json.loads(args.init)
    async with serve(lambda ws: session(ws, command, args.cwd, init), args.host, args.port, max_size=8 * 1024 * 1024):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
