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

export type Room = {
  id: string;
  name: string;
  status: "waiting" | "playing" | "finished";
  chat: Chat;
  players: Player[];
  maxPlayers: number;
};
