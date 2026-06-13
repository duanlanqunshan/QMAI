import sqlite3, json

db = sqlite3.connect('C:/Users/13728/.local/share/opencode/opencode.db')

# Check messages from the most recent sessions for QMAI-related content
sessions_to_check = [
    'ses_14808b568ffeg3vOzmQbkMrLK7',  # Build CLI harness
    'ses_14814faa8ffe0OHuSvUoTb7L9P',  # GitHub 项目快速分析指南
    'ses_1483f7006ffe4qlFVuWjVl2Sto',  # New session 2026-06-11
    'ses_148a3edccffe8dVXqXPrIXOweA',  # New session 2026-06-11
]

for sid in sessions_to_check:
    # Count messages
    count = db.execute("SELECT COUNT(*) FROM message WHERE session_id=?", (sid,)).fetchone()[0]
    print(f"\n=== Session {sid}: {count} messages ===")
    
    # Get first 3 messages to identify the topic
    msgs = db.execute("""
        SELECT id, data, time_created FROM message 
        WHERE session_id=? 
        ORDER BY time_created 
        LIMIT 5
    """, (sid,)).fetchall()
    
    for m in msgs:
        try:
            d = json.loads(m[1])
            text = str(d.get('text', d))[:200]
            role = d.get('role', '?')
            print(f"  [{role}] {text[:200]}")
        except:
            print(f"  [raw] {str(m[1])[:200]}")

db.close()