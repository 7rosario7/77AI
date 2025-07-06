# main.py
import os, uuid
import asyncpg
from fastapi import FastAPI, HTTPException, Depends, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, HTMLResponse
from jose import jwt, JWTError
from passlib.context import CryptContext

from chat import reflect  # your OpenAI wrapper

# ─── CONFIG ─────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET   = os.getenv("JWT_SECRET")
if not DATABASE_URL or not JWT_SECRET:
    raise RuntimeError("You must set both DATABASE_URL and JWT_SECRET")

ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── APP SETUP ───────────────────────────
app = FastAPI()

# ─── STARTUP / SHUTDOWN ──────────────────
@app.on_event("startup")
async def startup():
    app.state.db = await asyncpg.create_pool(DATABASE_URL)

@app.on_event("shutdown")
async def shutdown():
    await app.state.db.close()

# ─── CORS + STATIC ──────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ─── AUTH HELPERS ───────────────────────
def create_access_token(data: dict) -> str:
    return jwt.encode(data, JWT_SECRET, algorithm=ALGORITHM)

async def get_current_user(token: str = Cookie(None)):
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
    except JWTError:
        raise HTTPException(401, "Invalid token")
    return {"id": user_id}

# ─── HEALTHCHECK ────────────────────────
@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

# ─── AUTH ROUTES ────────────────────────
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
            username, hashed
        )
    return {"message": "OK"}

@app.post("/login")
async def login(username: str, password: str):
    async with app.state.db.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id,password_hash FROM users WHERE username=$1",
            username
        )
    if not row or not pwd_context.verify(password, row["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_access_token({"user_id": str(row["id"])})
    resp = JSONResponse({"message": "OK"})
    resp.set_cookie("access_token", token, httponly=True, samesite="lax")
    return resp

# ─── SESSION ROUTES ─────────────────────
@app.get("/sessions")
async def list_sessions(user=Depends(get_current_user)):
    rows = await app.state.db.fetch(
        "SELECT session_id,title FROM sessions WHERE user_id=$1 ORDER BY updated_at DESC",
        user["id"]
    )
    return [{"id":r["session_id"],"title":r["title"]} for r in rows]

@app.post("/sessions", status_code=201)
async def create_session(title: str, user=Depends(get_current_user)):
    sid = str(uuid.uuid4())
    await app.state.db.execute(
        "INSERT INTO sessions (session_id,user_id,title,created_at,updated_at) VALUES($1,$2,$3,now(),now())",
        sid, user["id"], title or "New Chat"
    )
    return {"id": sid, "title": title or "New Chat"}

@app.post("/reflect")
async def reflect_endpoint(session_id: str, prompt: str, user=Depends(get_current_user)):
    msgs = await reflect(app.state.db, prompt, user["id"], session_id)
    # bump session timestamp
    await app.state.db.execute(
        "UPDATE sessions SET updated_at=now() WHERE session_id=$1 AND user_id=$2",
        session_id, user["id"]
    )
    return {"messages": msgs}

@app.get("/messages")
async def get_messages(session_id: str, user=Depends(get_current_user)):
    rows = await app.state.db.fetch(
        "SELECT role,content FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at",
        session_id, user["id"]
    )
    return [{"role":r["role"],"content":r["content"]} for r in rows]

# ─── UI ROUTE ────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def root():
    return HTMLResponse(open("index.html","r",encoding="utf-8").read())

# ─── ENTRYPOINT ─────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
