import os
import uuid
import asyncpg

from fastapi import FastAPI, HTTPException, Depends, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, HTMLResponse
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt

from chat import reflect  # <-- your reflection logic

# === CONFIG ===
DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET    = os.getenv("JWT_SECRET")
ALGORITHM     = "HS256"
pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")

# === APP SETUP ===
app = FastAPI()

# 1) Health check first
@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

# 2) CORS, static, middleware, etc.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 🔧 adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory="static"), name="static")

# 3) Pydantic schemas, auth helpers, startup/shutdown...
class SignupRequest(BaseModel):
    username: str
    password: str
# … your other schemas …

def create_access_token(data: dict) -> str:
    return jwt.encode(data, JWT_SECRET, algorithm=ALGORITHM)

async def get_current_user(token: str = Cookie(None)):
    # … your logic …

@app.on_event("startup")
async def startup():
    app.state.db = await asyncpg.create_pool(DATABASE_URL)

@app.on_event("shutdown")
async def shutdown():
    await app.state.db.close()

# 4) All your routes (signup/login/me, sessions, messages, reflect)
# e.g.:
@app.post("/signup", status_code=201)
async def signup(req: SignupRequest):
    # … 

# 5) Finally serve the UI
@app.get("/", response_class=HTMLResponse)
async def root():
    return HTMLResponse(open("index.html", encoding="utf-8").read())
