import sqlite3
db = sqlite3.connect('C:/Users/13728/.local/share/opencode/opencode.db')
tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print("Tables:", tables)
for t in tables:
    cols = [r[1] for r in db.execute(f"PRAGMA table_info({t})")]
    count = db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"  {t}: {count} rows, columns: {cols}")
db.close()