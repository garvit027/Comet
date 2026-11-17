import json
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

class ConnectionManager:
  def __init__(self):
    self.active: dict[str, list[WebSocket]] = defaultdict(list)

  async def connect(self, auction_id: str, websocket: WebSocket):
    await websocket.accept()
    self.active[auction_id].append(websocket)

  def disconnect(self, auction_id: str, websocket: WebSocket):
    if auction_id in self.active and websocket in self.active[auction_id]:
      self.active[auction_id].remove(websocket)
      if not self.active[auction_id]:
        del self.active[auction_id]

  async def broadcast(self, auction_id: str, message: dict[str, Any]):
    data = json.dumps(message, default=str)
    for ws in list(self.active.get(auction_id, [])):
      try:
        await ws.send_text(data)
      except Exception:
        self.disconnect(auction_id, ws)

manager = ConnectionManager()
