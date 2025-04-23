import type { Player, Room } from "@/lib/types";
import { parentPort, workerData } from "worker_threads";

const room: Room = workerData;

parentPort?.on("message", (msg) => {
  if (msg === "get-room-data") {
    parentPort?.postMessage(room);
  }

  if (typeof msg === "object") {
    switch (msg.type) {
      case "join-player":
        const player: Player = msg.player;
        if (room.players.length >= 2) {
          parentPort?.postMessage({
            type: "room-full",
            roomId: room.id,
          });
          return;
        }
        const alreadyInRoom = room.players.some((p) => p.id === player.id);
        if (!alreadyInRoom) {
          room.players.push(player);
          parentPort?.postMessage({
            type: "player-joined",
            roomId: room.id,
            player,
          });
        }
        break;

      case "send-message":
        room.chat.messages.push(msg.message);
        parentPort?.postMessage({
          type: "message-sent",
          roomId: room.id,
          message: msg.message,
        });
        break;

      case "player-typing-on-in-chat":
        room.chat.playersTyping.push(msg.player);
        parentPort?.postMessage({
          type: "add-player-typing-in-chat-of-room",
          roomId: room.id,
          player: msg.player,
        });
        break;

      case "player-typing-off-in-chat":
        room.chat.playersTyping = room.chat.playersTyping.filter(
          (p) => p.id !== msg.player.id
        );
        parentPort?.postMessage({
          type: "remove-player-typing-in-chat-of-room",
          roomId: room.id,
          player: msg.player,
        });
        break;
    }
  }
});
