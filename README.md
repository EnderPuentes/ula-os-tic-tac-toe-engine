# 🎮 Tic-Tac-Toe Game Engine

### Overview

The Tic-Tac-Toe Game Engine is a robust, multi-threaded server implementation that powers the real-time multiplayer functionality of our Tic-Tac-Toe game. Built with Node.js and TypeScript, it leverages worker threads for efficient game room management and Socket.IO for real-time communication.

### 🧵 Worker Threads Implementation

The engine uses Node.js Worker Threads to handle game rooms concurrently. Each game room runs in its own worker thread, providing several benefits:

- **Isolated Game State**: Each room's game state is isolated in its own thread, preventing race conditions
- **Parallel Processing**: Multiple rooms can process moves and chat messages simultaneously
- **Resource Efficiency**: Better CPU utilization across multiple cores
- **Fault Isolation**: Issues in one room don't affect others

The worker thread architecture works as follows:

1. **Main Thread (Server)**

   - Handles socket connections and client communication
   - Manages room creation and deletion
   - Routes messages to appropriate worker threads

2. **Worker Threads (Rooms)**

   - Each room runs in a dedicated worker thread
   - Processes game logic and state updates
   - Handles chat messages and typing indicators
   - Communicates with main thread via message passing

3. **Message Queue System**
   - Implements a queue for processing messages sequentially
   - Prevents race conditions in game state updates
   - Ensures consistent game state across all operations

### 🚀 Features

- **Multi-threaded Architecture**

  - Each game room runs in a separate worker thread
  - Efficient resource utilization
  - Isolated game state management

- **Real-time Communication**

  - Socket.IO for bidirectional communication
  - Event-driven architecture
  - Low-latency game state synchronization

- **Game Room Management**

  - Dynamic room creation and deletion
  - Player matching and session management
  - Automatic cleanup of inactive rooms

- **Game Logic**
  - Official Tic-Tac-Toe rules implementation
  - Win condition validation
  - Turn-based gameplay management

### 🛠️ Technical Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Multiprogramming**: Worker Threads
- **Real-time Communication**: Socket.IO
- **Process Management**: Native Cluster
- **Code Quality**: ESLint, Prettier

### 📦 Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Start the server
pnpm start
```

### 🔧 Development

```bash
# Run in development mode
pnpm dev

# Run linter
pnpm lint
```

### 📚 API Documentation

The engine exposes the following Socket.IO events:

#### Room Management

- `create-room`: Create a new game room
- `get-rooms`: Get list of all active rooms
- `get-room`: Get data for a specific room
- `join-player-to-room`: Join an existing game room
- `leave-player-from-room`: Leave the current game room

#### Game Actions

- `player-plays-move-in-board-of-room`: Place a mark on the board
- `play-again-in-room`: Restart the game in the current room

#### Chat System

- `player-send-message-in-chat-of-room`: Send a message in the room chat
- `player-typing-on-in-chat-of-room`: Show typing indicator
- `player-typing-off-in-chat-of-room`: Hide typing indicator

#### Server Events

- `create-room-success`: Room creation confirmation
- `create-room-error`: Room creation error
- `join-player-to-room-success`: Player join confirmation
- `join-player-to-room-error`: Player join error
- `leave-player-from-room-success`: Player leave confirmation
- `leave-player-from-room-error`: Player leave error
- `player-plays-move-in-board-of-room-success`: Move confirmation
- `player-plays-move-in-board-of-room-error`: Move error
- `player-wins-in-board-of-room`: Game win notification
- `play-again-in-room-success`: Game restart confirmation
- `play-again-in-room-error`: Game restart error
- `rooms`: List of all active rooms
- `room`: Specific room data

### 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
