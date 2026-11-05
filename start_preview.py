"""Open the packaged study preview on this device using Python's standard library."""
from argparse import ArgumentParser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import mimetypes
import webbrowser

class AppHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        target = Path(self.translate_path(self.path))
        if not target.exists() and not target.suffix:
            self.path = '/index.html'
        return super().send_head()

def main():
    parser = ArgumentParser(description='Motion Dojang local preview')
    parser.add_argument('--public', action='store_true', help='Open the approved catalogue build')
    parser.add_argument('--port', type=int, default=4173)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    folder = Path(__file__).resolve().parent / ('dist' if args.public else 'dist-qa')
    if not (folder / 'index.html').is_file():
        parser.error('Build folder missing. See README.md.')
    mimetypes.add_type('model/gltf-binary', '.glb')
    handler = partial(AppHandler, directory=str(folder))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError:
        if args.port != 4173:
            raise
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    with server:
        address = f'http://127.0.0.1:{server.server_port}/'
        print(address, flush=True)
        if not args.no_browser:
            webbrowser.open(address)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == '__main__':
    main()
