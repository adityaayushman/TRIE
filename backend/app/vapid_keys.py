"""Generate a fresh Web Push VAPID keypair.

    python -m app.vapid_keys

Prints two env var lines to set together in the deployment (Render dashboard
/ .env) — TRIE_VAPID_PUBLIC_KEY and TRIE_VAPID_PRIVATE_KEY_B64. They are one
matched keypair: setting one without the other breaks every subscription.
Never commit the private half to the repo.
"""
from __future__ import annotations

import base64

from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from py_vapid import Vapid


def generate() -> tuple[str, str]:
    v = Vapid()
    v.generate_keys()
    public_raw = v.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    public_b64url = base64.urlsafe_b64encode(public_raw).rstrip(b"=").decode()
    private_b64 = base64.b64encode(v.private_pem()).decode()
    return public_b64url, private_b64


def main() -> int:
    public_key, private_key_b64 = generate()
    print(f"TRIE_VAPID_PUBLIC_KEY={public_key}")
    print(f"TRIE_VAPID_PRIVATE_KEY_B64={private_key_b64}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
