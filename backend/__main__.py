"""Entry point: python -m backend.main [options]

Default: desktop mode (PyWebView window)
--server: server-only mode (for dev with npm run dev)
--port N: specify port (server mode only)
"""

import sys


def main():
    if "--server" in sys.argv:
        # Server-only mode
        port = 8000
        for i, arg in enumerate(sys.argv):
            if arg == "--port" and i + 1 < len(sys.argv):
                port = int(sys.argv[i + 1])

        from backend.pywebview_launcher import launch_server

        launch_server(port)
    else:
        # Desktop mode — PyWebView window
        from backend.pywebview_launcher import launch_desktop

        launch_desktop()


if __name__ == "__main__":
    main()