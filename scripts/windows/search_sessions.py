import sqlite3, json

db = sqlite3.connect('C:/Users/13728/.local/share/opencode/opencode.db')

# Find sessions related to QMAI or chat-panel or build
keywords = ['QMAI', 'chapter', 'chat-panel', '青幕', 'build', 'selectedFile', '术语守卫', '章纲']
for kw in keywords:
    print(f"\n=== Searching: {kw} ===")
    # Search in session titles
    rows = db.execute("SELECT id, title, time_created, slug FROM session WHERE title LIKE ? ORDER BY time_created DESC LIMIT 5", (f'%{kw}%',)).fetchall()
    for r in rows:
        print(f"  Session: id={r[0]}, title={r[1]}, time={r[2]}, slug={r[3]}")

    # Search in message data
    rows = db.execute("SELECT DISTINCT s.id, s.title, s.time_created FROM message m JOIN session s ON m.session_id = s.id WHERE m.data LIKE ? ORDER BY s.time_created DESC LIMIT 5", (f'%{kw}%',)).fetchall()
    for r in rows:
        print(f"  MessageMatch: id={r[0]}, title={r[1]}, time={r[2]}")

# Also find most recent sessions
print("\n=== Most recent 10 sessions ===")
rows = db.execute("SELECT id, title, time_created, slug FROM session ORDER BY time_created DESC LIMIT 10").fetchall()
for r in rows:
    print(f"  id={r[0]}, title={r[1]}, time={r[2]}, slug={r[3]}")

db.close()