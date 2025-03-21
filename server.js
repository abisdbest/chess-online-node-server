// server.js (Server) - COMPLETE
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;
app.use(cors());

const rooms = {};
const STARTING_POSITION = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
];

// Helper function
function notationToCoords(notation) {
    const col = notation.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(notation.slice(1));
    return [row, col];
}

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  socket.on('joinRoom', (room) => {
    if (rooms[room] && rooms[room].players.length >= 2) {
        socket.emit('roomFull');
        return;
    }
    if (socket.currentRoom) {
        socket.leave(socket.currentRoom);
        if (rooms[socket.currentRoom]) {
          socket.to(socket.currentRoom).emit('opponentDisconnected');
        }
    }

    socket.join(room);
    socket.currentRoom = room;

    if (!rooms[room]) {
        // Initialize chat history for the room
        rooms[room] = { players: [], board: JSON.parse(JSON.stringify(STARTING_POSITION)), currentPlayer: 'white', chatHistory: [] };
    }
    rooms[room].players.push(socket.id);

    let playerColor;
    let isCurrentPlayerTurn;

    if (rooms[room].players.length === 1) {
        playerColor = 'white';
        isCurrentPlayerTurn = true;
    } else {
        playerColor = 'black';
        isCurrentPlayerTurn = false;
    }

    socket.emit('gameState', {
        board: rooms[room].board,
        playerColor,
        isCurrentPlayerTurn,
        room
    });

    console.log(`Client ${socket.id} joined room ${room} as ${playerColor}`);
  });

  socket.on('newMove', ({ room, move }) => {
        if (rooms[room]) {
            const fromCoords = notationToCoords(move.from);
            const toCoords = notationToCoords(move.to);
            rooms[room].board[toCoords[0]][toCoords[1]] = rooms[room].board[fromCoords[0]][fromCoords[1]];
            rooms[room].board[fromCoords[0]][fromCoords[1]] = '';

            // Toggle the current player
            rooms[room].currentPlayer = rooms[room].currentPlayer === 'white' ? 'black' : 'white';

            // Broadcast the move AND the current player
            io.to(room).emit('moveUpdate', { move, currentPlayer: rooms[room].currentPlayer });

        } else {
            console.error(`Room ${room} not found!`);
            socket.emit("invalidRoom");
        }
    });

    // --- CHAT HANDLING ---
    socket.on('chatMessage', ({ room, message }) => {
        if (rooms[room]) {
            const chatEntry = { sender: socket.id, message };
            rooms[room].chatHistory.push(chatEntry); // Store the message
            io.to(room).emit('chatMessage', chatEntry);
        } else {
            console.error(`Room ${room} not found for chat!`);
            socket.emit("invalidRoom");
        }
    });

    // New event handler for chat history requests
    socket.on('requestChatHistory', (room) => {
      if (rooms[room]) {
        socket.emit('chatHistory', rooms[room].chatHistory);
      } else {
        console.error(`Room ${room} not found for chat history request!`);
        socket.emit("invalidRoom"); // Or a specific "no history" event
      }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected', socket.id);
      if (socket.currentRoom && rooms[socket.currentRoom]) {
        rooms[socket.currentRoom].players = rooms[socket.currentRoom].players.filter(id => id !== socket.id);
         socket.to(socket.currentRoom).emit('opponentDisconnected');
        if (rooms[socket.currentRoom].players.length === 0) {
            delete rooms[socket.currentRoom];
        }
      }
  });

    socket.on('leaveRoom', (room) => {
        console.log(`Client ${socket.id} left room ${room}`);
        socket.leave(room);

        if (rooms[room]) {
            rooms[room].players = rooms[room].players.filter(id => id !== socket.id);
            socket.to(room).emit('opponentDisconnected');
            if(rooms[room].players.length === 0){
                delete rooms[room]
            }
        }
    });
});

app.get('/test', (req, res) => {
  res.send('test V3.0');
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
