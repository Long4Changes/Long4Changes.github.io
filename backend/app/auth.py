import os
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Header, HTTPException, status

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "cyberkb-default-jwt-secret-key-2026")
ALGORITHM = "HS256"
ADMIN_PASSKEY = os.getenv("ADMIN_PASSKEY", "cyberkb-root-secret")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))

def create_access_token(role: str = "root") -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": "owner",
        "role": role,
        "iat": now,
        "exp": expire
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

def verify_passkey(passkey: str) -> bool:
    return passkey == ADMIN_PASSKEY

async def get_current_role(authorization: Optional[str] = Header(None)) -> str:
    """Extract caller role from Authorization header: 'root' if valid bearer token, else 'guest'."""
    if not authorization:
        return "guest"

    if authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        payload = decode_access_token(token)
        if payload and payload.get("role") == "root":
            return "root"

    return "guest"
