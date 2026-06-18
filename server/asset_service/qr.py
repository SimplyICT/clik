import qrcode
from io import BytesIO
import base64

def generate_qr_code(asset_id: str, base_url: str = "") -> str:
    url = f"{base_url}/mobile/asset/{asset_id}" if base_url else asset_id
    img = qrcode.make(url)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()

def generate_qr_bytes(asset_id: str, base_url: str = "") -> bytes:
    url = f"{base_url}/mobile/asset/{asset_id}" if base_url else asset_id
    img = qrcode.make(url)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
