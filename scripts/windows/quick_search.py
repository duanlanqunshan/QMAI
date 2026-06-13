import sqlite3, json
db = sqlite3.connect('C:/Users/13728/.local/share/opencode/opencode.db')

# Quick check of the big session (661 msgs)
sid = 'ses_148a3edccffe8dVXqXPrIXOweA'
print(f"Session {sid}:")
# Count parts
c = db.execute("SELECT COUNT(*) FROM part WHERE session_id=?", (sid,))
print(f"  Parts: {c.fetchone()[0]}")

# Read first 5 parts
c = db.execute("SELECT data FROM part WHERE session_id=? ORDER BY id LIMIT 5", (sid,))
for row in c.fetchall():
    d = json.loads(row[0])
    text = str(d.get('text', ''))[:200]
    tp = d.get('type', '?')
    role = d.get('role', '?')
    print(f"  [{tp}|{role}] {text}")

# Also search parts that contain 'QMAI' in specific session IDs
print("\nSearching for QMAI in parts of recent sessions...")
recent_sessions = db.execute("""
    SELECT id FROM session WHERE time_created > 1780000000000
""").fetchall()
for (sid_,) in recent_sessions:
    c = db.execute("SELECT COUNT(*) FROM part WHERE session_id=? AND data LIKE ?", (sid_, '%QMAI%'))
    cnt = c.fetchone()[0]
    if cnt > 0:
        print(f"  Found QMAI in session {sid_}: {cnt} parts")
    c = db.execute("SELECT COUNT(*) FROM part WHERE session_id=? AND data LIKE ?", (sid_, '%chat-panel%'))
    cnt = c.fetchone()[0]
    if cnt > 0:
        print(f"  Found chat-panel in session {sid_}: {cnt} parts")

db.close()