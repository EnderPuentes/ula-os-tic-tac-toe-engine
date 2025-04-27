import { Player, Room } from "@/lib/types";
import { parentPort, workerData } from "worker_threads";

const room: Room = workerData;
let isProcessing = false;

const processMessage = (msg: any) => {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  switch (msg.type) {
    case "join-player":
      const player: Player = msg.player;
      if (room.players.length >= 2) {
        parentPort?.postMessage({
          type: "room-full",
          roomId: room.id,
        });
        isProcessing = false;
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

    default:
      parentPort?.postMessage({
        type: "unknown-message",
        message: msg,
      });
  }

  isProcessing = false;
};

parentPort?.on("message", (msg) => {
  if (msg === "get-room-data") {
    parentPort?.postMessage(room);
  } else if (typeof msg === "object") {
    processMessage(msg);
  }
});
