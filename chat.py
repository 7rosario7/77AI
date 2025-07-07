import os
import uuid
from typing import List, Dict, Any

from openai import AsyncOpenAI
from asyncpg import Pool

from principles import principles
from questions import questions

# === AI SETUP ===
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("You must set OPENAI_API_KEY")

openai = AsyncOpenAI(api_key=OPENAI_API_KEY)

# === MEMORY HELPERS ===
async def seed_user_memory(db: Pool, user_id: int, new_messages: List[Dict[str, Any]]):
    """
    Extract “important” sentences from the last chunk of conversation and store
    them as user memories.
    """
    # for simplicity, we’ll just take any user messages longer than 100 chars
    for m in new_messages:
        if m["role"] == "user" and len(m["content"]) > 100:
            await db.execute(
                """
                INSERT INTO memories (user_id, content)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
                """,
                user_id,
                m["content"][:500]
            )

async def fetch_user_memories(db: Pool, user_id: int) -> List[str]:
    rows = await db.fetch(
        "SELECT content FROM memories WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5",
        user_id,
    )
    return [r["content"] for r in rows]


# === MAIN REFLECT FUNCTION ===
async def reflect(
    db: Pool,
    prompt: str,
    user_id: int,
    session_id: str,
) -> List[Dict[str, str]]:
    # 1) get past chat messages
    msgs = await db.fetch(
        """
        SELECT role, content
          FROM messages
         WHERE session_id = $1
           AND user_id    = $2
         ORDER BY created_at
        """,
        session_id,
        user_id,
    )
    history = [{"role": r["role"], "content": r["content"]} for r in msgs]

    # 2) get top user memories
    memories = await fetch_user_memories(db, user_id)
    if memories:
        history.insert(
            0,
            {
                "role": "system",
                "content": "Here are some things I know about the user:\n\n"
                + "\n– ".join(memories),
            },
        )

    # 3) build system prompt
    system_parts = [
        "# — System prompt for AI —",
        "You are a compassionate, patient, and measured mirror of the user.",
        "Respond in a neutral, reflective tone, combining empathetic insights and gentle guidance.",
        "Use no more than one or two open-ended questions per reply.",
        *principles,
        "You may ask one of these deeper questions if it feels natural:\n\n" + "\n".join(questions),
    ]
    system_prompt = "\n\n".join(system_parts)

    # 4) append our new user prompt
    history.append({"role": "user", "content": prompt})

    # 5) call OpenAI
    response = await openai.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "system", "content": system_prompt}, *history],
    )
    ai_msg = response.choices[0].message

    # 6) persist both sides
    await db.execute(
        """
        INSERT INTO messages (session_id, user_id, role, content)
        VALUES ($1, $2, 'user', $3), ($1, $2, 'assistant', $4)
        """,
        session_id,
        user_id,
        prompt,
        ai_msg.content,
    )

    # 7) seed long-term memory
    await seed_user_memory(db, user_id, [{"role": "user", "content": prompt}])

    return [{"role": "assistant", "content": ai_msg.content}]
