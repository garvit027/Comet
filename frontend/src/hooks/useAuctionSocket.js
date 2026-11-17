import { useEffect, useRef } from "react";
import { wsUrl } from "../api/client";

export default function useAuctionSocket(auctionId, onEvent) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!auctionId) return;
    const token = localStorage.getItem("comet_token");
    const url = wsUrl(`/api/auctions/ws/${auctionId}`);
    let ws;
    let closed = false;
    let retry = 0;

    const connect = () => {
      ws = new WebSocket(url);
      ws.onmessage = (ev) => {
        try { onEventRef.current?.(JSON.parse(ev.data)); } catch {}
      };
      ws.onclose = () => {
        if (!closed) {
          retry = Math.min(retry + 1, 5);
          setTimeout(connect, 800 * retry);
        }
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    };
    connect();
    return () => { closed = true; try { ws?.close(); } catch {} };
  }, [auctionId]);
}
