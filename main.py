import os
import uuid

import asyncpg
from fastapi import FastAPI, HTTPException, Depends, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, HTMLResponse
from passlib.context import CryptContext
from jose import JWTError, jwt

from chat import reflect  # your OpenAI wrapper

# === CONFIG ===
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY environment variable is required")

ALGORITHM = "HS256"

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

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# === LIFESPAN EVENTS ===
@app.on_event("startup")
async def _startup():
    app.state.db = await asyncpg.create_pool(DATABASE_URL)

@app.on_event("shutdown")
async def _shutdown():
    await app.state.db.close()

# === UTILITIES ===
def create_access_token(data: dict) -> str:
    return jwt.encode(data, JWT_SECRET, algorithm=ALGORITHM)

async def get_current_user(token: str = Cookie(None)):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise JWTError()
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"id": user_id}

# === HEALTH CHECK ===
@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

# === AUTH ROUTES ===
@app.post("/signup", status_code=201)
async def signup(username: str, password: str):
    hashed = pwd_context.hash(password)
    async with app.state.db.acquire() as conn:
        exists = await conn.fetchval(
            "SELECT 1 FROM users WHERE username=$1", username
        )
        if exists:
            raise HTTPException(400, "Username already taken")
        await conn.execute(
            "INSERT INTO users (username,password_hash) VALUES($1,$2)",
            username,
            hashed,
        )
    return {"message": "OK"}

@app.post("/login")
async def login(username: str, password: str):
    async with app.state.db.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id,password_hash FROM users WHERE username=$1", username
        )
    if not row or not pwd_context.verify(password, row["password_hash"]):
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

# === SESSION CRUD ===
@app.get("/sessions")
async def list_sessions(user=Depends(get_current_user)):
    rows = await app.state.db.fetch(
        "SELECT session_id,title FROM sessions WHERE user_id=$1 ORDER BY updated_at DESC",
        user["id"],
    )
    return [{"id": r["session_id"], "title": r["title"]} for r in rows]

@app.post("/sessions", status_code=201)
async def create_session(title: str, user=Depends(get_current_user)):
    sid = str(uuid.uuid4())
    await app.state.db.execute(
        "INSERT INTO sessions (session_id,user_id,title,created_at,updated_at) "
        "VALUES($1,$2,$3,now(),now())",
        sid,
        user["id"],
        title or "New Chat",
    )
    return {"id": sid, "title": title or "New Chat"}

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user=Depends(get_current_user)):
    await app.state.db.execute(
        "DELETE FROM sessions WHERE session_id=$1 AND user_id=$2",
        session_id,
        user["id"],
    )
    await app.state.db.execute(
        "DELETE FROM messages WHERE session_id=$1 AND user_id=$2",
        session_id,
        user["id"],
    )
    return {"ok": True}

@app.delete("/sessions/{session_id}/messages")
async def clear_session(session_id: str, user=Depends(get_current_user)):
    await app.state.db.execute(
        "DELETE FROM messages WHERE session_id=$1 AND user_id=$2",
        session_id,
        user["id"],
    )
    return {"ok": True}

# === MESSAGES ===
@app.get("/messages")
async def get_messages(session_id: str, user=Depends(get_current_user)):
    rows = await app.state.db.fetch(
        "SELECT role,content FROM messages WHERE session_id=$1 AND user_id=$2 "
        "ORDER BY created_at",
        session_id,
        user["id"],
    )
    return [{"role": r["role"], "content": r["content"]} for r in rows]

@app.post("/reflect")
async def reflect_endpoint(session_id: str, prompt: str, user=Depends(get_current_user)):
    msgs = await reflect(app.state.db, prompt, user["id"], session_id)
    await app.state.db.execute(
        "UPDATE sessions SET updated_at=now() WHERE session_id=$1 AND user_id=$2",
        session_id,
        user["id"],
    )
    return {"messages": msgs}

# === UI ===
@app.get("/", response_class=HTMLResponse)
async def root():
    with open("index.html", encoding="utf-8") as f:
        return HTMLResponse(f.read())

# === RUN SERVER ===
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=True,
    )
