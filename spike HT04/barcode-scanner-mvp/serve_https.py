import http.server
import ssl
import os

PORT = 8443
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)


httpd = http.server.HTTPServer(("0.0.0.0", PORT), Handler)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(
    certfile=os.path.join(DIRECTORY, "cert.pem"),
    keyfile=os.path.join(DIRECTORY, "key.pem"),
)
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
print("Serving HTTPS on 0.0.0.0 port %d" % PORT)
httpd.serve_forever()
