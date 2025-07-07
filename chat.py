import os
import asyncpg
import openai
from openai import AsyncOpenAI

# --- System prompt for AI (from your principles) ---
SYSTEM_PROMPT = """
You are a compassionate, patient, and measured mirror of the user.
Respond in a neutral, reflective tone, combining empathetic insights and gentle guidance.
Use no more than one or two open-ended questions per reply.
[...add the rest of your system prompt here...]
"""

# read your key exactly once, at import time:
_API_KEY = os.getenv("OPENAI_API_KEY")
if not _API_KEY:
    raise RuntimeError("Missing OPENAI_API_KEY environment variable")

# create a single shared client:
openai_client = AsyncOpenAI(api_key=_API_KEY)

async def reflect(db_pool: asyncpg.Pool, prompt: str, user_id: int, session_id: str, initial: bool = False):
    """
    - db_pool: asyncpg.Pool
    - prompt: message to send (system if initial=True, otherwise user message)
    - user_id, session_id: for storing/fetching messages
    """
    # 1) load history
    rows = await db_pool.fetch(
        "SELECT role, content FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at",
        session_id, user_id
    )
    messages = [{"role": r["role"], "content": r["content"]} for r in rows]

    # 2) if initial, inject system prompt at the start
    if initial:
        messages = [{"role": "system", "content": prompt}] + messages
        # we don't store system messages in DB

    # 3) if user message
    if not initial:
        messages.append({"role": "user", "content": prompt})

    # 4) call OpenAI
    resp = await openai_client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=messages
    )
    assistant_msg = resp.choices[0].message.content

    # 5) store user + assistant if not initial
    if not initial:
        await db_pool.execute(
            "INSERT INTO messages (session_id, user_id, role, content, created_at) VALUES ($1,$2,$3,$4,now())",
            session_id, user_id, "user", prompt
        )
    await db_pool.execute(
        "INSERT INTO messages (session_id, user_id, role, content, created_at) VALUES ($1,$2,$3,$4,now())",
        session_id, user_id, "assistant", assistant_msg
    )

    return [{"role": "assistant", "content": assistant_msg}]
