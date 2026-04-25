import os, re, sys
from pathlib import Path
from dotenv import load_dotenv
from kiteconnect import KiteConnect

ENV_PATH = Path(__file__).parent.parent / ".env"
load_dotenv(ENV_PATH)

api_key    = os.getenv("KITE_API_KEY", "").strip()
api_secret = os.getenv("KITE_API_SECRET", "").strip()

if not api_key or not api_secret:
    print("ERROR: KITE_API_KEY and KITE_API_SECRET must be set in .env")
    sys.exit(1)

kite = KiteConnect(api_key=api_key)

# Step 1 — just print the URL
if len(sys.argv) < 2:
    print(kite.login_url())
    sys.exit(0)

# Step 2 — exchange token and save
request_token = sys.argv[1].strip()
data         = kite.generate_session(request_token, api_secret=api_secret)
access_token = data["access_token"]
print(f"ACCESS_TOKEN={access_token}")

env_text = ENV_PATH.read_text(encoding="utf-8")
if re.search(r"^KITE_ACCESS_TOKEN\s*=", env_text, re.MULTILINE):
    env_text = re.sub(
        r"^(KITE_ACCESS_TOKEN\s*=).*$",
        f"KITE_ACCESS_TOKEN={access_token}",
        env_text,
        flags=re.MULTILINE,
    )
else:
    env_text += f"\nKITE_ACCESS_TOKEN={access_token}\n"

ENV_PATH.write_text(env_text, encoding="utf-8")
print(".env updated.")
