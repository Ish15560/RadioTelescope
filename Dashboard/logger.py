import asyncio
import websockets
from datetime import datetime

LOG_FILE = "sfu_archive.csv"

async def archive_telemetry():
    uri = "ws://localhost:8765"
    print(f"[Python Logger] Connecting to telemetry stream at {uri}...")
    
    try:
        with open(LOG_FILE, "x", encoding="utf-8") as f:
            f.write("Timestamp,Voltage,SFU_Equivalent\n")
    except FileExistsError:
        pass

    async with websockets.connect(uri) as websocket:
        print("[Python Logger] Connected! Writing stream to sfu_archive.csv...")
        while True:
            try:
                data = await websocket.recv()
                val_str = data.strip()
                v = float(val_str)
                sfu = v * 50.0 + 120.0
                ts = datetime.now().isoformat()
                
                with open(LOG_FILE, "a", encoding="utf-8") as f:
                    f.write(f"{ts},{v:.3f},{sfu:.2f}\n")
                print(f"Logged SFU: {sfu:.2f}")
            except ValueError:
                pass
            except Exception as e:
                print(f"[Python Logger] Parse/stream warning: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(archive_telemetry())
    except KeyboardInterrupt:
        print("\n[Python Logger] Stopped.")