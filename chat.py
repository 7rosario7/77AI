import os
import openai
from openai import AsyncOpenAI

# read your key exactly once, at import time:
_API_KEY = os.getenv("OPENAI_API_KEY")
if not _API_KEY:
    raise RuntimeError("Missing OPENAI_API_KEY environment variable")

# create a single shared client:
openai_client = AsyncOpenAI(api_key=_API_KEY)

async def reflect(db_pool, prompt: str, user_id: str, session_id: str):
    """
    - db_pool: asyncpg.Pool
    - prompt: user’s message
    - user_id, session_id: for storing/fetching messages
    """
    # 1) load history from the DB
    rows = await db_pool.fetch(
        "SELECT role, content FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at",
        session_id, user_id
    )
    messages = [{"role": r["role"], "content": r["content"]} for r in rows]

    # 2) append the new user prompt
    messages.append({"role": "user", "content": prompt})

    # 3) ask OpenAI (you can adjust model & params here)
    resp = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages
    )
    assistant_msg = resp.choices[0].message.content

    # 4) store user + assistant messages back into the DB
    await db_pool.execute(
        "INSERT INTO messages (session_id, user_id, role, content, created_at) VALUES ($1,$2,$3,$4,now())",
        session_id, user_id, "user", prompt
    )
    await db_pool.execute(
        "INSERT INTO messages (session_id, user_id, role, content, created_at) VALUES ($1,$2,$3,$4,now())",
        session_id, user_id, "assistant", assistant_msg
    )

    # 5) return the full thread (or only the assistant message)
    return [{"role":"assistant","content":assistant_msg}]
