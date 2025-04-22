export type Player = {
  id: string;
  name: string;
  avatar: string;
};

export type Room = {
  id: string;
  name: string;
  players: Player[];
};
