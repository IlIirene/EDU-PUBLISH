import sqlite3
import json

conn = sqlite3.connect('/AstrBot/data/data_v4.db')
cursor = conn.cursor()

# Check command_configs table
try:
    cursor.execute("SELECT * FROM command_configs LIMIT 10")
    configs = cursor.fetchall()
    print("Command configs:")
    for config in configs:
        print(f"  {config}")
except Exception as e:
    print(f"Error checking command_configs: {e}")

# Check preferences table
try:
    cursor.execute("SELECT key, value FROM preferences WHERE key LIKE '%plugin%' LIMIT 10")
    prefs = cursor.fetchall()
    print(f"\nPlugin preferences: {prefs}")
except Exception as e:
    print(f"Error checking preferences: {e}")

conn.close()