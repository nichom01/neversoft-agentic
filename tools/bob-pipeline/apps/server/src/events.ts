import { EventEmitter } from "node:events";
import type { ServerEvent } from "@bob-pipeline/shared";

/** In-process event bus; the SSE endpoint forwards everything to the UI. */
class Bus extends EventEmitter {
  publish(e: ServerEvent) {
    this.emit("event", e);
  }
  subscribe(fn: (e: ServerEvent) => void): () => void {
    this.on("event", fn);
    return () => this.off("event", fn);
  }
}

export const bus = new Bus();
bus.setMaxListeners(100);
