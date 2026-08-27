from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import jwt
import bcrypt

SECRET_KEY = "caresync_dual_coding_super_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
ACCESS_TOKEN_EXPIRE_LONG = 60 * 24 * 7  # 7 days if "Remember me" is checked

app = FastAPI(title="Care Sync Dual-Coding API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://aayush-icd-connect.netlify.app",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper functions for direct bcrypt hashing & verification
def hash_password(password: str) -> str:
    # Truncate to 72 bytes for bcrypt compatibility
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode('utf-8')[:72]
    hash_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(pwd_bytes, hash_bytes)

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Mock user database (Email & ABHA ID support)
# Default password: doctor123
users_db = [
    {
        "id": "doc_01",
        "email": "doctor@caresync.in",
        "abha_id": "91-1234-5678-9012",
        "full_name": "Dr. Sonu Prasad",
        "role": "AYUSH Doctor",
        "department": "Ayurveda",
        "hashed_password": hash_password("doctor123")
    },
    {
        "id": "doc_02",
        "email": "snehan@caresync.in",
        "abha_id": "91-9876-5432-1098",
        "full_name": "Dr. Snehan Naicker",
        "role": "Chief Medical Officer",
        "department": "Integrated Medicine",
        "hashed_password": hash_password("doctor123")
    }
]

# --- Request & Response Schemas ---
class LoginRequest(BaseModel):
    identifier: str  # Email or ABHA ID
    password: str
    remember_me: Optional[bool] = False

class ABHAOAuthRequest(BaseModel):
    abha_token: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    full_name: str
    email: str
    abha_id: str
    role: str
    department: str

# --- Routes ---

@app.get("/")
def root():
    return {"status": "Care Sync Dual-Coding API is active"}

@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    """
    Standard login: matches Email or ABHA ID with password.
    """
    user = next(
        (u for u in users_db if u["email"].lower() == payload.identifier.lower() or u["abha_id"] == payload.identifier),
        None
    )
    
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Email/ABHA ID or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_LONG if payload.remember_me else ACCESS_TOKEN_EXPIRE_MINUTES)
    
    token = create_access_token(
        data={"sub": user["id"], "role": user["role"], "abha_id": user["abha_id"]},
        expires_delta=expires_delta
    )
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user["id"],
        "full_name": user["full_name"],
        "email": user["email"],
        "abha_id": user["abha_id"],
        "role": user["role"],
        "department": user["department"]
    }

@app.post("/api/auth/abha-oauth", response_model=AuthResponse)
def login_with_abha(payload: ABHAOAuthRequest):
    """
    OAuth 2.0 ABHA Sign-in mock endpoint.
    """
    user = users_db[0]
    token = create_access_token(
        data={"sub": user["id"], "role": user["role"], "abha_id": user["abha_id"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user["id"],
        "full_name": user["full_name"],
        "email": user["email"],
        "abha_id": user["abha_id"],
        "role": user["role"],
        "department": user["department"]
    }