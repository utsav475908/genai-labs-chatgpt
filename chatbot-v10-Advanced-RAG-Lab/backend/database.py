import sqlite3
from pathlib import Path
from datetime import datetime, timezone

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "genai_labs.db"


def now():
    return datetime.now(timezone.utc).isoformat()


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():

    conn = get_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL DEFAULT 'New Chat',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (conversation_id)
                REFERENCES conversations(id)
                ON DELETE CASCADE
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            memory TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()


# ---------------------------------------------------------
# USERS
# ---------------------------------------------------------

def create_user(name, email, password_hash):

    conn = get_connection()

    cursor = conn.execute(
        """
        INSERT INTO users
        (name, email, password_hash, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (
            name,
            email.lower(),
            password_hash,
            now()
        )
    )

    user_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return user_id


def get_user_by_email(email):

    conn = get_connection()

    row = conn.execute(
        """
        SELECT *
        FROM users
        WHERE email = ?
        """,
        (email.lower(),)
    ).fetchone()

    conn.close()

    return dict(row) if row else None


def get_user_by_id(user_id):

    conn = get_connection()

    row = conn.execute(
        """
        SELECT id, name, email, created_at
        FROM users
        WHERE id = ?
        """,
        (user_id,)
    ).fetchone()

    conn.close()

    return dict(row) if row else None


# ---------------------------------------------------------
# CONVERSATIONS
# ---------------------------------------------------------

def create_conversation(user_id, title="New Chat"):

    timestamp = now()

    conn = get_connection()

    cursor = conn.execute(
        """
        INSERT INTO conversations
        (user_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        """,
        (
            user_id,
            title,
            timestamp,
            timestamp
        )
    )

    conversation_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return conversation_id


def list_conversations(user_id):

    conn = get_connection()

    rows = conn.execute(
        """
        SELECT id, title, created_at, updated_at
        FROM conversations
        WHERE user_id = ?
        ORDER BY updated_at DESC
        """,
        (user_id,)
    ).fetchall()

    conn.close()

    return [dict(row) for row in rows]


def get_conversation(conversation_id, user_id):

    conn = get_connection()

    row = conn.execute(
        """
        SELECT *
        FROM conversations
        WHERE id = ?
        AND user_id = ?
        """,
        (
            conversation_id,
            user_id
        )
    ).fetchone()

    conn.close()

    return dict(row) if row else None


def add_message(
    conversation_id,
    user_id,
    role,
    content
):

    timestamp = now()

    conn = get_connection()

    conn.execute(
        """
        INSERT INTO messages
        (conversation_id, role, content, created_at)
        SELECT ?, ?, ?, ?
        WHERE EXISTS (
            SELECT 1
            FROM conversations
            WHERE id = ?
            AND user_id = ?
        )
        """,
        (
            conversation_id,
            role,
            content,
            timestamp,
            conversation_id,
            user_id
        )
    )

    conn.execute(
        """
        UPDATE conversations
        SET updated_at = ?
        WHERE id = ?
        AND user_id = ?
        """,
        (
            timestamp,
            conversation_id,
            user_id
        )
    )

    conn.commit()
    conn.close()


def get_messages(
    conversation_id,
    user_id
):

    conn = get_connection()

    rows = conn.execute(
        """
        SELECT
            m.role,
            m.content,
            m.created_at
        FROM messages m
        JOIN conversations c
            ON m.conversation_id = c.id
        WHERE m.conversation_id = ?
        AND c.user_id = ?
        ORDER BY m.id ASC
        """,
        (
            conversation_id,
            user_id
        )
    ).fetchall()

    conn.close()

    return [dict(row) for row in rows]


def delete_conversation(
    conversation_id,
    user_id
):

    conn = get_connection()

    conn.execute(
        """
        DELETE FROM conversations
        WHERE id = ?
        AND user_id = ?
        """,
        (
            conversation_id,
            user_id
        )
    )

    conn.commit()
    conn.close()


# ---------------------------------------------------------
# MEMORIES
# ---------------------------------------------------------

def add_memory(user_id, memory):

    timestamp = now()

    conn = get_connection()

    conn.execute(
        """
        INSERT INTO memories
        (user_id, memory, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        """,
        (
            user_id,
            memory,
            timestamp,
            timestamp
        )
    )

    conn.commit()
    conn.close()


def get_memories(user_id):

    conn = get_connection()

    rows = conn.execute(
        """
        SELECT
            id,
            memory,
            created_at,
            updated_at
        FROM memories
        WHERE user_id = ?
        ORDER BY updated_at DESC
        """,
        (user_id,)
    ).fetchall()

    conn.close()

    return [dict(row) for row in rows]


def delete_memory(
    memory_id,
    user_id
):

    conn = get_connection()

    conn.execute(
        """
        DELETE FROM memories
        WHERE id = ?
        AND user_id = ?
        """,
        (
            memory_id,
            user_id
        )
    )

    conn.commit()
    conn.close()