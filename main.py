import os
import uuid
import asyncpg
from fastapi import FastAPI, HTTPException, Depends, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.types import ASGIApp, Receive, Scope, Send
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from chat import reflect

# ─── CONFIG ──────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set")
# ──────────────────────────────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── APP & MIDDLEWARE ─────────────────────────────────────────────────────────
app = FastAPI(title="77 AI Chat")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this if you lock to specific domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
# ──────────────────────────────────────────────────────────────────────────────

# ─── LIFESPAN: STARTUP & SHUTDOWN ─────────────────────────────────────────────
@app.router.lifespan
async def lifespan(app: FastAPI):
    # on startup
    app.state.db = await asyncpg.create_pool(DATABASE_URL)
    yield
    # on shutdown
    await app.state.db.close()
# ──────────────────────────────────────────────────────────────────────────────

# ─── Pydantic Models ─────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class NewSessionRequest(BaseModel):
    title: str

class ReflectRequest(BaseModel):
    session_id: str
    prompt: str
# ──────────────────────────────────────────────────────────────────────────────

# ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
def create_access_token(data: dict) -> str:
    return jwt.encode(data, JWT_SECRET, algorithm="HS256")

async def get_current_user(token: str = Cookie(None)):
    if token is None:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
    except JWTError:
        raise HTTPException(401, "Invalid token")
    return {"id": user_id}
# ──────────────────────────────────────────────────────────────────────────────

# ─── HEALTHCHECK ──────────────────────────────────────────────────────────────
@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
# ──────────────────────────────────────────────────────────────────────────────

# ─── UI ROUTE ─────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    with open("index.html", encoding="utf-8") as f:
        return HTMLResponse(f.read())
# ──────────────────────────────────────────────────────────────────────────────

# ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
@app.post("/signup", status_code=201)
async def signup(req: SignupRequest):
    hashed = pwd_context.hash(req.password)
    async with app.state.db.acquire() as conn:
        if await conn.fetchval("SELECT 1 FROM users WHERE username=$1", req.username):
            raise HTTPException(400, "Username already taken")
        await conn.execute(
            "INSERT INTO users(username,password_hash) VALUES($1,$2)",
            req.username, hashed
        )
    return {"message": "OK"}

@app.post("/login")
async def login(req: LoginRequest):
    async with app.state.db.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id,password_hash FROM users WHERE username=$1", req.username
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
# ──────────────────────────────────────────────────────────────────────────────

# ─── SESSION ROUTES ───────────────────────────────────────────────────────────
@app.get("/sessions")
async def list_sessions(user=Depends(get_current_user)):
    rows = await app.state.db.fetch(
        "SELECT session_id,title FROM sessions WHERE user_id=$1 ORDER BY updated_at DESC",
        user["id"]
    )
    return [{"id": r["session_id"], "title": r["title"]} for r in rows]

@app.post("/sessions", status_code=201)
async def create_session(req: NewSessionRequest, user=Depends(get_current_user)):
    sid = str(uuid.uuid4())
    title = req.title or "New Chat"
    await app.state.db.execute(
        "INSERT INTO sessions(session_id,user_id,title,created_at,updated_at) VALUES($1,$2,$3,now(),now())",
        sid, user["id"], title
    )
    return {"id": sid, "title": title}

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user=Depends(get_current_user)):
    await app.state.db.execute(
        "DELETE FROM sessions WHERE session_id=$1 AND user_id=$2",
        session_id, user["id"]
    )
    await app.state.db.execute(
        "DELETE FROM messages WHERE session_id=$1 AND user_id=$2",
        session_id, user["id"]
    )
    return {"ok": True}

@app.delete("/sessions/{session_id}/messages")
async def clear_session(session_id: str, user=Depends(get_current_user)):
    await app.state.db.execute(
        "DELETE FROM messages WHERE session_id=$1 AND user_id=$2",
        session_id, user["id"]
    )
    return {"ok": True}
# ──────────────────────────────────────────────────────────────────────────────

# ─── MESSAGE ROUTES ───────────────────────────────────────────────────────────
@app.get("/messages")
async def get_messages(session_id: str, user=Depends(get_current_user)):
    rows = await app.state.db.fetch(
        "SELECT role,content FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at",
        session_id, user["id"]
    )
    return [{"role": r["role"], "content": r["content"]} for r in rows]

@app.post("/reflect")
async def reflect_endpoint(req: ReflectRequest, user=Depends(get_current_user)):
    msgs = await reflect(app.state.db, req.prompt, user["id"], req.session_id)
    # bump session timestamp
    await app.state.db.execute(
        "UPDATE sessions SET updated_at=now() WHERE session_id=$1 AND user_id=$2",
        req.session_id, user["id"]
    )
    return {"messages": msgs}
# ──────────────────────────────────────────────────────────────────────────────
