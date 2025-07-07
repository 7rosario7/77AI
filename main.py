import os
import uuid

import asyncpg
from fastapi import FastAPI, HTTPException, Depends, Cookie, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, HTMLResponse
from passlib.context import CryptContext
from jose import JWTError, jwt
from pydantic import BaseModel

from chat import reflect  # our updated reflect
from typing import List, Dict

# === CONFIG ===
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/db")
JWT_SECRET    = os.getenv("JWT_SECRET", "your-very-secret-key")
ALGORITHM     = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# === APP SETUP ===
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory="static"), name="static")

# === SCHEMAS ===
class SignupRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class NewSessionRequest(BaseModel):
    title: str | None = None

class ChatRequest(BaseModel):
    session_id: str
    prompt: str

# === AUTH HELPERS ===
def create_access_token(data: dict) -> str:
    return jwt.encode(data, JWT_SECRET, algorithm=ALGORITHM)

async def get_current_user(access_token: str = Cookie(None, alias="access_token")):
    if not access_token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(access_token, JWT_SECRET, algorithms=[ALGORITHM])
        return {"id": int(payload["user_id"])}
    except JWTError:
        raise HTTPException(401, "Invalid token")

# === LIFESPAN ===
@app.on_event("startup")
async def startup():
    app.state.db = await asyncpg.create_pool(DATABASE_URL)
    # auto-create tables (including memories)
    ddl = """
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      session_id UUID PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      title      TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS messages (
      id         SERIAL PRIMARY KEY,
      session_id UUID    NOT NULL REFERENCES sessions(session_id),
      user_id    INTEGER NOT NULL REFERENCES users(id),
      role       TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      created_at TIMESTAMP DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS memories (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      content    TEXT    NOT NULL,
      created_at TIMESTAMP DEFAULT now(),
      UNIQUE(user_id, content)
    );
    """
    async with app.state.db.acquire() as conn:
        await conn.execute(ddl)

@app.on_event("shutdown")
async def shutdown():
    await app.state.db.close()

# === AUTH ENDPOINTS ===
@app.post("/signup", status_code=201)
async def signup(req: SignupRequest):
    hashed = pwd_context.hash(req.password)
    async with app.state.db.acquire() as conn:
        if await conn.fetchval("SELECT 1 FROM users WHERE username=$1", req.username):
            raise HTTPException(400, "Username taken")
        await conn.execute(
            "INSERT INTO users (username,password_hash) VALUES($1,$2)",
            req.username, hashed
        )
    return {"message": "OK"}

@app.post("/login")
async def login(req: LoginRequest):
    async with app.state.db.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id,password_hash FROM users WHERE username=$1",
            req.username
        )
    if not row or not pwd_context.verify(req.password, row["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_access_token({"user_id": str(row["id"])})
    resp = JSONResponse({"message": "OK"})
    resp.set_cookie("access_token", token, httponly=True, samesite="lax")
    return resp

@app.post("/logout")
async def logout():
    resp = JSONResponse({"message": "OK"})
    resp.delete_cookie("access_token")
    return resp

@app.get("/me")
async def me(user=Depends(get_current_user)):
    return {"id": user["id"]}

# === SESSION MANAGEMENT ===
@app.get("/sessions")
async def list_sessions(user=Depends(get_current_user)):
    rows = await app.state.db.fetch(
        "SELECT session_id AS id, title FROM sessions WHERE user_id=$1 ORDER BY updated_at DESC",
        user["id"]
    )
    return [{"id": r["id"], "title": r["title"]} for r in rows]

@app.post("/sessions", status_code=201)
async def create_session(req: NewSessionRequest, user=Depends(get_current_user)):
    sid = str(uuid.uuid4())
    title = req.title or "New Chat"
    await app.state.db.execute(
        "INSERT INTO sessions (session_id,user_id,title) VALUES($1,$2,$3)",
        sid, user["id"], title
    )
    return {"id": sid, "title": title}

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user=Depends(get_current_user)):
    async with app.state.db.acquire() as conn:
        await conn.execute(
          "DELETE FROM messages WHERE session_id=$1 AND user_id=$2",
          session_id, user["id"]
        )
        await conn.execute(
          "DELETE FROM sessions WHERE session_id=$1 AND user_id=$2",
          session_id, user["id"]
        )
    return {"ok": True}

# === CHAT ENDPOINT ===
@app.post("/chat")
async def chat_endpoint(req: ChatRequest, user=Depends(get_current_user)):
    messages = await reflect(
        app.state.db,
        req.prompt,
        user["id"],
        req.session_id
    )
    # refresh session timestamp
    await app.state.db.execute(
        "UPDATE sessions SET updated_at=now() WHERE session_id=$1 AND user_id=$2",
        req.session_id, user["id"]
    )
    return {"messages": messages}

# === UI ===
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return HTMLResponse(open("index.html", encoding="utf-8").read())

# === RUNNER ===
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
