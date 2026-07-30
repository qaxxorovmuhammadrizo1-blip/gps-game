const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const turf = require('@turf/turf');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Fayllar aynan public papkasidan olinishini aniq ko'rsatamiz
app.use(express.static(path.join(__dirname, 'public')));

// Bosh sahifa so'ralganda public/index.html ni ochish
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Barcha o'yinchilar va ularning hududlari saqlanadigan xotira
const players = {};

io.on('connection', (socket) => {
  console.log('O\'yinchi ulandi:', socket.id);

  socket.emit('initGame', players);

  socket.on('joinGame', (profile) => {
    players[socket.id] = {
      id: socket.id,
      name: profile.name || "O'yinchi",
      photo: profile.photo || "https://ui-avatars.com/api/?name=User",
      lat: profile.lat || 40.6324,
      lng: profile.lng || 72.3765,
      path: [],
      distance: 0,
      territoryFeature: null
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

  socket.on('claimTerritory', () => {
    const player = players[socket.id];
    if (!player || player.path.length < 3) return;

    try {
      const points = turf.featureCollection(player.path.map(c => turf.point(c)));
      const newZone = turf.convex(points);

      if (!newZone) return;

      if (player.territoryFeature) {
        player.territoryFeature = turf.union(player.territoryFeature, newZone);
      } else {
        player.territoryFeature = newZone;
      }

      Object.keys(players).forEach(otherId => {
        if (otherId !== socket.id && players[otherId].territoryFeature) {
          try {
            const cutZone = turf.difference(players[otherId].territoryFeature, player.territoryFeature);
            players[otherId].territoryFeature = cutZone;
          } catch (err) {
            console.log("Kesishda xatolik:", err);
          }
        }
      });

      player.path = [];
      io.emit('territoryUpdated', players);

    } catch (e) {
      console.error("Hudud yaratishda xato:", e);
    }
  });

  socket.on('disconnect', () => {
    console.log('O\'yinchi chiqib ketdi:', socket.id);
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    
