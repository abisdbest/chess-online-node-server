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

// Store moves and positions for each room
const rooms = {};

// Encoding/Decoding function (adjust as needed)
function encodeMove(move) {
  return `${move.from.join(',')}-${move.to.join(',')}`;
}

function decodeMove(encodedMove) {
  const [from, to] = encodedMove.split('-');
  return {
    from: from.split(',').map(Number),
    to: to.split(',').map(Number),
  };
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected');

  // Join a room
  socket.on('joinRoom', (room) => {
    socket.join(room);

    if (!rooms[room]) {
      rooms[room] = {
        moves: [],
        positions: [],
        currentPlayer: 1, // Player 1 starts
      };
    }

    // Send current game state to the newly joined client
    socket.emit('gameState', rooms[room]);
  });

  // Handle new move
  socket.on('newMove', ({ room, move, position }) => {
    if (rooms[room]) {
      // Check if it's the correct player's turn
      if (rooms[room].currentPlayer === 1) {
        const encodedMove = encodeMove(move); 
        rooms[room].moves.push(encodedMove);
        rooms[room].positions.push(position);
        rooms[room].currentPlayer = 2; // Switch to player 2's turn

        // Emit the move update with the encoded move
        io.to(room).emit('moveUpdate', { move: encodedMove, position, currentPlayer: 2 });
      } else {
        // Send an error to the client because it's not their turn
        socket.emit('error', 'Its not your turn.');
      }
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Add a simple GET route
app.get('/test', (req, res) => {
  res.send('test V2.0');
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));