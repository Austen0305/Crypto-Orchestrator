from server_fastapi.main import app

print("Registered routes:")
for route in app.routes:
    if hasattr(route, 'path'):
        methods = getattr(route, 'methods', [])
        print(f"  {route.path} - {methods}")