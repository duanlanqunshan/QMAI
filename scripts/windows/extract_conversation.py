import sqlite3, json

db = sqlite3.connect('C:/Users/13728/.local/share/opencode/opencode.db')

sid = 'ses_148a3edccffe8dVXqXPrIXOweA'

# Extract user messages that mention QMAI (they are the feature requests)
print("=== USER MESSAGES mentioning QMAI ===")
c = db.execute("""
    SELECT DISTINCT m.id, m.data FROM message m
    WHERE m.session_id=? AND m.data LIKE ?
    AND json_extract(m.data, '$.role') = 'user'
    ORDER BY m.time_created LIMIT 20
""", (sid, '%QMAI%'))
for row in c.fetchall():
    d = json.loads(row[1])
    text = str(d.get('text', ''))[:500]
    print(f"\n--- Msg {row[0]} ---")
    print(text)

print("\n\n=== USER MESSAGES mentioning chapter/panel related ===")
for term in ['%chat-panel%', '%selectedFile%', '%chapter%']:
    c = db.execute("""
        SELECT DISTINCT m.id, m.data FROM message m
        WHERE m.session_id=? AND m.data LIKE ?
        AND json_extract(m.data, '$.role') = 'user'
        ORDER BY m.time_created LIMIT 5
    """, (sid, term))
    for row in c.fetchall():
        d = json.loads(row[1])
        text = str(d.get('text', ''))[:300]
        print(f"\n[{term}] Msg {row[0]}: {text}")

db.close()