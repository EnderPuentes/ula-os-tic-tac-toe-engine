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
};

type PlayerAndRoomId = {
  roomId: string;
  player: Player;
};

export type PlayerJoined = PlayerAndRoomId;
export type PlayerAlreadyInRoom = PlayerAndRoomId;
export type PlayerLeft = PlayerAndRoomId;
export type PlayerTypingOnInChatOfRoom = PlayerAndRoomId;
export type PlayerTypingOffInChatOfRoom = PlayerAndRoomId;

export type MessageSent = {
  roomId: string;
  message: Message;
};

export type WorkerMessageInput = {
  type:
    | "get-data"
    | "join-player"
    | "leave-player"
    | "send-message"
    | "player-typing-on-in-chat-of-room"
    | "player-typing-off-in-chat-of-room";
  data: Message | Player | Room | null;
};

export type WorkerMessageOutput = {
  type:
    | "data"
    | "player-joined"
    | "player-left"
    | "player-already-in-room"
    | "room-full"
    | "message-sent"
    | "player-typing-on-in-chat-of-room"
    | "player-typing-off-in-chat-of-room";
  data:
    | Room
    | Player
    | Message
    | PlayerJoined
    | PlayerAlreadyInRoom
    | PlayerLeft
    | PlayerTypingOnInChatOfRoom
    | PlayerTypingOffInChatOfRoom
    | MessageSent;
};
