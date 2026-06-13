import sqlite3, json

db = sqlite3.connect('C:/Users/13728/.local/share/opencode/opencode.db')

# Search for sessions mentioning QMAI or duanlanqunshan or Mochocyang in any message
search_terms = ['QMAI', 'duanlanqunshan', 'Mochocyang', '青幕AI', 'QMaiWrite', 'chat-panel', '章节写作', '术语守卫', '章纲', 'selectedFile', 'chat-panel']

for term in search_terms:
    rows = db.execute("""
        SELECT DISTINCT m.session_id, s.title, s.time_created 
        FROM message m 
        JOIN session s ON m.session_id = s.id 
        WHERE m.data LIKE ? 
        LIMIT 5
    """, (f'%{term}%',)).fetchall()
    if rows:
        print(f"\n=== Found '{term}' in: ===")
        for r in rows:
            print(f"  Session: {r[0]}, title: {r[1]}, time: {r[2]}")

# Also check the "New session" ones more carefully
recent = db.execute("""
    SELECT id, title, time_created FROM session 
    WHERE time_created > 1780000000000 
    ORDER BY time_created DESC LIMIT 20
""").fetchall()
print("\n=== Sessions after ~2026-06-01 ===")
for r in recent:
    print(f"  {r[0]} | {r[2]} | {r[1][:80]}")

db.close()