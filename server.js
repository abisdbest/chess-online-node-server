const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Use CORS middleware
app.use(cors());

// Store moves and positions for each room
const rooms = {};

io.on('connection', (socket) => {
    console.log('New client connected');

    // Join a room
    socket.on('joinRoom', (room) => {
        socket.join(room);
        if (!rooms[room]) {
            rooms[room] = {
                moves: [],
                positions: []
            };
        }
        // Send current game state to the newly joined client
        socket.emit('gameState', rooms[room]);
    });

    // Handle new move
    socket.on('newMove', ({ room, move, position }) => {
        if (rooms[room]) {
            rooms[room].moves.push(move);
            rooms[room].positions.push(position);
            io.to(room).emit('moveUpdate', { move, position });
        }
    });

    // Handle client disconnect
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
