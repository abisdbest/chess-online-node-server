const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

// Use CORS middleware
app.use(cors());

const rooms = {}; // To store room information

function createRoom(room) {
  rooms[room] = {
    players: {}, // Store player information with their color
    moves: [],    // Store the list of moves
    currentPlayer: 'white', // Track which player's turn it is
  };
}

function validateMove(move) {
  // Add your move validation logic here
  return true;
}

io.on('connection', (socket) => {
  console.log('New client connected');

  // Handle player joining a room
  socket.on('joinRoom', (room) => {
    if (!rooms[room]) {
      createRoom(room);
    }

    const roomData = rooms[room];

    if (Object.keys(roomData.players).length >= 2) {
      socket.emit('roomFull', 'The room is full');
      return;
    }

    const color = Object.keys(roomData.players).length === 0 ? 'white' : 'black';
    roomData.players[socket.id] = color;

    socket.join(room);
    socket.emit('colorAssigned', color);

    if (Object.keys(roomData.players).length === 2) {
      io.to(room).emit('gameStart', { color: roomData.players });
    }

    // Send the current game state to the newly joined client
    socket.emit('gameState', roomData);
  });

  // Handle new move from a player
  socket.on('newMove', ({ room, move }) => {
    const roomData = rooms[room];
    const currentColor = roomData.players[socket.id];

    if (roomData.currentPlayer !== currentColor) {
      socket.emit('notYourTurn', 'It is not your turn');
      return;
    }

    // Validate and apply the move
    if (validateMove(move)) {
      roomData.moves.push(move);
      roomData.currentPlayer = currentColor === 'white' ? 'black' : 'white';
      io.to(room).emit('moveUpdate', { move });
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    
    // Handle player disconnection
    for (const room in rooms) {
      const roomData = rooms[room];
      if (roomData.players[socket.id]) {
        delete roomData.players[socket.id];
        
        // Notify other players
        io.to(room).emit('playerDisconnected', { id: socket.id });

        // If there are no players left, delete the room
        if (Object.keys(roomData.players).length === 0) {
          delete rooms[room];
        }
        break;
      }
    }
  });
});

// Add a simple GET route
app.get('/test', (req, res) => {
  res.send('test V3.0');
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
