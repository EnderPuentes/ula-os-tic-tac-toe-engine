export type Player = {
  id: string;
  name: string;
  avatar: string;
};

export type RoomPlayer = Player & {
  symbol: BoardSymbol;
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

export type RoomStatus = "waiting" | "playing" | "finished" | "done";

export type BoardSymbol = "X" | "O" | null;

export type BoardMove = {
  row: number;
  col: number;
  symbol: BoardSymbol;
};

export type CellPosition = { row: number; col: number };

export type PlayerResult = {
  wins: number;
  losses: number;
  draws: number;
};

export type Game = {
  board: BoardSymbol[][];
  currentPlayer: RoomPlayer | null;
  winnerPlayer: RoomPlayer | null;
  winnerLine: [CellPosition, CellPosition, CellPosition] | null;
};

export type Room = {
  id: string;
  name: string;
  status: RoomStatus;
  game: Game;
  chat: Chat;
  players: {
    player1: RoomPlayer | null;
    player2: RoomPlayer | null;
  };
  results: {
    player1: PlayerResult;
    player2: PlayerResult;
  };
};

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
    | "player-typing-off-in-chat-of-room"
    | "player-plays-move-in-board"
    | "start-game"
    | "play-again";
  data: Message | Player | Room | BoardMove | null;
};

export type WorkerMessageOutput = {
  type:
    | "data"
    | "join-player-error"
    | "join-player-success"
    | "leave-player-success"
    | "leave-player-error"
    | "send-message-success"
    | "send-message-error"
    | "player-typing-on-in-chat-of-room"
    | "player-typing-off-in-chat-of-room"
    | "player-plays-move-in-board-success"
    | "player-plays-move-in-board-error"
    | "start-game-success"
    | "start-game-error"
    | "play-again-success"
    | "play-again-error";
  data: Room | RoomPlayer | Message | MessageSent | BoardMove | string;
};
