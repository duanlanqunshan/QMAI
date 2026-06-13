import sqlite3, json

db = sqlite3.connect('C:/Users/13728/.local/share/opencode/opencode.db')
sid = 'ses_148a3edccffe8dVXqXPrIXOweA'

# Find user parts that mention QMAI
print("=== USER PARTS mentioning QMAI ===")
c = db.execute("""
    SELECT DISTINCT p.id, p.data, m.id as msg_id FROM part p
    JOIN message m ON p.message_id = m.id
    WHERE p.session_id=?
    AND p.data LIKE '%QMAI%'
    AND json_extract(p.data, '$.type') = 'text'
    LIMIT 30
""", (sid,))

for row in c.fetchall():
    d = json.loads(row[1])
    text = str(d.get('text', ''))[:500]
    role = d.get('role', '?')
    if role == 'user' or text.strip():
        print(f"\n--- Part {row[0]} (msg {row[2]}) [{role}] ---")
        print(text[:400])

print("\n\n=== USER PARTS mentioning chat-panel ===")
c = db.execute("""
    SELECT DISTINCT p.id, p.data, m.id as msg_id FROM part p
    JOIN message m ON p.message_id = m.id
    WHERE p.session_id=?
    AND p.data LIKE '%chat-panel%'
    AND json_extract(p.data, '$.type') = 'text'
    LIMIT 15
""", (sid,))

for row in c.fetchall():
    d = json.loads(row[1])
    text = str(d.get('text', ''))[:300]
    print(f"\n[{d.get('role','?')}] {text[:300]}")

db.close()