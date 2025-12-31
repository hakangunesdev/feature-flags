import os
import secrets
from fastapi import Header, HTTPException

def require_admin(x_admin_key: str | None = Header(default=None, alias="X-Admin-Key")):
    expected = os.getenv("ADMIN_KEY", "")
    if not expected:
        # Yanlışlıkla açık admin bırakmamak için
        raise HTTPException(status_code=500, detail="ADMIN_KEY not configured")

    if not x_admin_key or not secrets.compare_digest(x_admin_key, expected):
        raise HTTPException(status_code=401, detail="Invalid admin key")

"""
admin.py dosyasında olan router doğrulamasının depends kısmının doğrulamasını bu sınıf yapmaktadır.
parametre olarak header'ı alır ve bu header'I X-Admin_key den alır.
admin_key değerini alıp expected değişkenine atıyoruz,altında da bu değerlerin kontrolu yapılmaktadır.
"""