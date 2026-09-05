"""
Authentication router handling user registration (/signup) and authentication (/login).
"""

from datetime import datetime, timedelta
import os
import bcrypt
from fastapi import APIRouter, HTTPException, status
import jwt

from database import supabase
from schemas import TokenResponse, UserCreate, UserLogin

router = APIRouter(prefix="/auth", tags=["Authentication"])

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440


def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


@router.post(
    "/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
def signup(user: UserCreate):
    existing = (
        supabase.table("users").select("*").eq("email", user.email).execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered.",
        )

    hashed_pw = hash_password(user.password)

    new_user_data = {
        "email": user.email,
        "full_name": user.full_name,
        "password_hash": hashed_pw,
        "created_at": datetime.utcnow().isoformat(),
    }

    response = supabase.table("users").insert(new_user_data).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user account.",
        )

    created_user = response.data[0]
    token = create_access_token(
        {"sub": created_user["email"], "id": created_user["id"]}
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": created_user["id"],
        "email": created_user["email"],
        "full_name": created_user.get("full_name"),
    }


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin):
    response = (
        supabase.table("users")
        .select("*")
        .eq("email", credentials.email)
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user = response.data[0]
    if not user.get("password_hash") or not verify_password(
        credentials.password, user["password_hash"]
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token({"sub": user["email"], "id": user["id"]})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user["id"],
        "email": user["email"],
        "full_name": user.get("full_name"),
    }