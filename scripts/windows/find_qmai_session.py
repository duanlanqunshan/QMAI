import sqlite3, json

db = sqlite3.connect('C:/Users/13728/.local/share/opencode/opencode.db')

# Check parts table for QMAI-related content in recent sessions
# The parts table likely has the actual text content
terms = ['QMAI', 'duanlanqunshan', 'Mochocyang', 'chat-panel', 'tauri build', 'selectedFile', 'chapter-utils', 'chapter-panel']

for term in terms:
    rows = db.execute("""
        SELECT DISTINCT p.session_id, s.title, s.time_created 
        FROM part p 
        JOIN session s ON p.session_id = s.id 
        WHERE p.data LIKE ? 
        LIMIT 5
    """, (f'%{term}%',)).fetchall()
    if rows:
        print(f"\n=== Found '{term}' in part data ===")
        for r in rows:
            print(f"  Session: {r[0]}, title: {r[1]}, time: {r[2]}")

# Also search for Chinese terms
zh_terms = ['章纲', '术语守卫', '写作面板', '重构', '来源标签']
for term in zh_terms:
    rows = db.execute("""
        SELECT DISTINCT p.session_id, s.title, s.time_created 
        FROM part p 
        JOIN session s ON p.session_id = s.id 
        WHERE p.data LIKE ? 
        LIMIT 5
    """, (f'%{term}%',)).fetchall()
    if rows:
        print(f"\n=== Found '{term}' in part data ===")
        for r in rows:
            print(f"  Session: {r[0]}, title: {r[1]}, time: {r[2]}")

# Check the big session (661 msgs) for first few part contents
print("\n=== Checking big session ses_148a3edccffe8dVXqXPrIXOweA ===")
parts = db.execute("""
    SELECT p.data, p.message_id FROM part p
    WHERE p.session_id = 'ses_148a3edccffe8dVXqXPrIXOweA'
    ORDER BY p.id LIMIT 3
""").fetchall()
for p in parts:
    try:
        d = json.loads(p[0])
        text = str(d.get('text', ''))[:300]
        print(f"  [{d.get('type','?')}|{d.get('role','?')}] {text}")
    except Exception as e:
        print(f"  parse error: {e}, raw: {str(p[0])[:200]}")

db.close()