// server.js
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


io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  socket.on('joinRoom', (room) => {

      // Check if the room exists and is full
      if (rooms[room] && rooms[room].players.length >= 2) {
        socket.emit('roomFull');
        return;
    }
    // Leave previous room if any
    if (socket.currentRoom) {
        socket.leave(socket.currentRoom);
          // Notify the other player about the disconnection
        if (rooms[socket.currentRoom]) {
          socket.to(socket.currentRoom).emit('opponentDisconnected');
        }
    }

    socket.join(room);
    socket.currentRoom = room;

     if (!rooms[room]) {
            rooms[room] = { players: [], board: JSON.parse(JSON.stringify(STARTING_POSITION)) };
        }
        rooms[room].players.push(socket.id);

    const playerColor = rooms[room].players.length === 1 ? 'white' : 'black';  //first to join gets white
    const isCurrentPlayerTurn = rooms[room].players.length === 1;

    socket.emit('gameState', {
          board: rooms[room].board,
          playerColor,
          isCurrentPlayerTurn, // Send the turn status
          room // Send room code
      });

       console.log(`Client ${socket.id} joined room ${room} as ${playerColor}`);

  });

  socket.on('newMove', ({ room, move }) => {
      if (rooms[room]) {
          // Update the board state *before* emitting the move
          const fromCoords = notationToCoords(move.from);
          const toCoords = notationToCoords(move.to);
          rooms[room].board[toCoords[0]][toCoords[1]] = rooms[room].board[fromCoords[0]][fromCoords[1]];
          rooms[room].board[fromCoords[0]][fromCoords[1]] = '';


          // Broadcast the move to everyone in the room.
          io.to(room).emit('moveUpdate', { move });

      } else {
          console.error(`Room ${room} not found!`); //should not happen
          socket.emit("invalidRoom");
      }
  });


    socket.on('disconnect', () => {
        console.log('Client disconnected', socket.id);
      if (socket.currentRoom && rooms[socket.currentRoom]) {
        rooms[socket.currentRoom].players = rooms[socket.currentRoom].players.filter(id => id !== socket.id);
         // Notify the other player in the room
         socket.to(socket.currentRoom).emit('opponentDisconnected');

          // Clean up the room if it's empty
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
             // Notify other player in the room
            socket.to(room).emit('opponentDisconnected');

              // Clean up the room if it is empty
            if(rooms[room].players.length === 0){
                delete rooms[room]
            }
        }
    });

      // Helper function (move to top-level scope)
      function notationToCoords(notation) {
        const col = notation.charCodeAt(0) - 'a'.charCodeAt(0);
        const row = 8 - parseInt(notation.slice(1));
        return [row, col];
    }

});


app.get('/test', (req, res) => {
  res.send('test V3.0');
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
