const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const players = {};

io.on('connection', (socket) => {
  console.log('Oyinchi ulandi:', socket.id);

  socket.on('joinGame', (profile) => {
    players[socket.id] = {
      id: socket.id,
      name: profile.name || "O'yinchi",
      photo: profile.photo || "https://ui-avatars.com/api/?name=User",
      lat: profile.lat || 40.6324,
      lng: profile.lng || 72.3765,
      path: [],
      distance: 0
    };
    io.emit('updatePlayers', players);
  });

  socket.on('playerMove', (data) => {
    const player = players[socket.id];
    if (!player) return;

    player.lat = data.lat;
    player.lng = data.lng;

    if (data.dist > 0) {
      player.distance += data.dist;
    }
    player.path.push([data.lng, data.lat]);

    io.emit('playerMoved', {
      id: socket.id,
      lat: data.lat,
      lng: data.lng,
      path: player.path,
      distance: player.distance
    });
  });

  socket.on('disconnect', () => {
    console.log('Oyinchi chiqib ketdi:', socket.id);
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
