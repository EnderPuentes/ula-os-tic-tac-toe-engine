export type Player = {
  id: string;
  name: string;
  avatar: string;
};

export type Chat = {
  playersTyping: Player[];
  messages: Message[];
};

export type Message = {
  content: string;
  sender: Player;
  timestamp: number;
};

export type Game = {
  board: string[];
  currentPlayer: Player | null;
  winner: Player | null;
};

export type Room = {
  id: string;
  name: string;
  status: "waiting" | "playing" | "finished";
  game: Game;
  chat: Chat;
  players: Player[];
  maxPlayers: number;
};

export type WorkerMessageSend = {
  type:
    | "get"
    | "join-player"
    | "leave-player"
    | "send-message"
    | "player-typing-on-in-chat"
    | "player-typing-off-in-chat";
  data: Message | Player | Room | null;
};

export type WorkerMessageReceive = {
  type:
    | "player-joined"
    | "player-left"
    | "player-already-in-room"
    | "room-full"
    | "message-sent"
    | "emit-player-typing-in-chat-of-room"
    | "emit-player-typing-off-in-chat-of-room";
  data:
    | Room
    | Player
    | Message
    | { roomId: string; player: Player }
    | { roomId: string; message: Message };
};
