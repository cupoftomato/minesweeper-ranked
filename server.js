const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const COLS = 16;
const ROWS = 16;
const MINES = 40;
const TOTAL_SAFE = COLS * ROWS - MINES;

const rooms = {};

// Player data (in-memory for Elo)
const playersData = {}; // socket.id -> { elo: 1200 }

// Queues
let normalQueue = []; // array of socket ids
let rankedQueue = []; // array of socket ids

function getElo(id) {
  if (!playersData[id]) playersData[id] = { elo: 1200 };
  return playersData[id].elo;
}

function updateElo(winnerId, loserId) {
  let winnerElo = getElo(winnerId);
  let loserElo = getElo(loserId);
  
  // Simple Elo calc (K=32)
  let expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  let expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
  
  playersData[winnerId].elo = Math.round(winnerElo + 32 * (1 - expectedWinner));
  playersData[loserId].elo = Math.round(loserElo + 32 * (0 - expectedLoser));
}

// Matchmaking Loop for Ranked
setInterval(() => {
  // Sort ranked queue by Elo
  rankedQueue.sort((a, b) => getElo(a) - getElo(b));
  
  // Match adjacent pairs (they have the closest Elo)
  while (rankedQueue.length >= 2) {
    let p1 = rankedQueue.shift();
    let p2 = rankedQueue.shift();
    createMatch(p1, p2, 'ranked');
  }
}, 2000); // Check every 2s

function createMatch(p1Id, p2Id, type) {
  let roomId = crypto.randomUUID();
  rooms[roomId] = {
    id: roomId,
    type: type,
    players: {},
    status: 'playing',
    masterGrid: generateMasterBoard()
  };

  const room = rooms[roomId];
  const startCell = getSafeStart(room.masterGrid);

  // Init players
  [p1Id, p2Id].forEach(pid => {
    room.players[pid] = {
      id: pid,
      openedGrid: Array(ROWS).fill().map(() => Array(COLS).fill(false)),
      flagsGrid: Array(ROWS).fill().map(() => Array(COLS).fill(false)),
      progress: 0,
      strikes: 0,
      frozenUntil: 0
    };
    
    // Flood fill initial area
    let initialReveal = floodFill(room.masterGrid, startCell.r, startCell.c, room.players[pid].openedGrid);
    room.players[pid].progress = initialReveal.length;

    // Join socket room
    const sock = io.sockets.sockets.get(pid);
    if(sock) {
      sock.join(roomId);
      sock.roomId = roomId;
      sock.emit('matchFound', {
        roomId: roomId,
        type: type,
        myElo: type === 'ranked' ? getElo(pid) : null,
        oppElo: type === 'ranked' ? getElo(pid === p1Id ? p2Id : p1Id) : null,
        rows: ROWS, cols: COLS, totalSafe: TOTAL_SAFE
      });
      
      let revealed = [];
      for(let r=0; r<ROWS; r++){
          for(let c=0; c<COLS; c++){
              if(room.players[pid].openedGrid[r][c]){
                  revealed.push({r, c, val: room.masterGrid[r][c]});
              }
          }
      }
      sock.emit('reveal', revealed);
    }
  });

  updateProgress(room);
}

// Helper: Generate Master Board
function generateMasterBoard() {
  let grid = Array(ROWS).fill().map(() => Array(COLS).fill(0));
  let minesPlaced = 0;
  while (minesPlaced < MINES) {
    let r = Math.floor(Math.random() * ROWS);
    let c = Math.floor(Math.random() * COLS);
    if (grid[r][c] !== -1) {
      grid[r][c] = -1;
      minesPlaced++;
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === -1) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          let nr = r + dr;
          let nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] === -1) count++;
        }
      }
      grid[r][c] = count;
    }
  }
  return grid;
}

function floodFill(grid, r, c, openedGrid) {
  let revealed = [];
  let queue = [{r, c}];
  while(queue.length > 0) {
    let curr = queue.shift();
    if (openedGrid[curr.r][curr.c]) continue;
    openedGrid[curr.r][curr.c] = true;
    revealed.push({r: curr.r, c: curr.c, val: grid[curr.r][curr.c]});
    if (grid[curr.r][curr.c] === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          let nr = curr.r + dr;
          let nc = curr.c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !openedGrid[nr][nc]) queue.push({r: nr, c: nc});
        }
      }
    }
  }
  return revealed;
}

function getSafeStart(masterGrid) {
  let safeCells = [];
  for(let r=0; r<ROWS; r++) {
    for(let c=0; c<COLS; c++) {
      if(masterGrid[r][c] === 0) safeCells.push({r, c});
    }
  }
  if(safeCells.length===0){
    for(let r=0; r<ROWS; r++) {
      for(let c=0; c<COLS; c++) {
        if(masterGrid[r][c] !== -1) safeCells.push({r, c});
      }
    }
  }
  return safeCells[Math.floor(Math.random() * safeCells.length)];
}

function updateProgress(room) {
  const prog = {};
  for(let pid in room.players) {
      prog[pid] = room.players[pid].progress;
  }
  io.to(room.id).emit('progressUpdate', prog);
}

function handleWin(room, winnerId, reason) {
  if (room.status === 'ended') return;
  room.status = 'ended';
  
  let loserId = Object.keys(room.players).find(id => id !== winnerId);
  
  let p1EloStr = "", p2EloStr = "";
  if (room.type === 'ranked' && loserId) {
    let oldW = getElo(winnerId);
    let oldL = getElo(loserId);
    updateElo(winnerId, loserId);
    p1EloStr = ` (+${getElo(winnerId) - oldW} Elo)`;
    p2EloStr = ` (${getElo(loserId) - oldL} Elo)`;
  }

  io.to(winnerId).emit('gameOver', { winner: winnerId, reason: reason + p1EloStr });
  if (loserId) io.to(loserId).emit('gameOver', { winner: winnerId, reason: reason + p2EloStr });
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  // Ensure Elo init
  getElo(socket.id);

  socket.on('findMatch', (type) => {
    // Remove from existing queues just in case
    normalQueue = normalQueue.filter(id => id !== socket.id);
    rankedQueue = rankedQueue.filter(id => id !== socket.id);

    if (type === 'normal') {
      normalQueue.push(socket.id);
      if (normalQueue.length >= 2) {
        let p1 = normalQueue.shift();
        let p2 = normalQueue.shift();
        createMatch(p1, p2, 'normal');
      }
    } else if (type === 'ranked') {
      rankedQueue.push(socket.id);
      // Handled by interval
    }
  });

  socket.on('cancelMatch', () => {
    normalQueue = normalQueue.filter(id => id !== socket.id);
    rankedQueue = rankedQueue.filter(id => id !== socket.id);
  });

  socket.on('clickCell', ({r, c}) => {
    if (!socket.roomId) return;
    const room = rooms[socket.roomId];
    if (!room || room.status !== 'playing') return;
    const p = room.players[socket.id];
    if (!p) return;

    if (Date.now() < p.frozenUntil) return;
    if (p.openedGrid[r][c] || p.flagsGrid[r][c]) return;

    const val = room.masterGrid[r][c];
    if (val === -1) {
      p.strikes++;
      if (p.strikes >= 3) {
          let winnerId = Object.keys(room.players).find(id => id !== socket.id);
          handleWin(room, winnerId, 'Opponent got 3 Strikes!');
      } else {
          let freezeMs = p.strikes === 1 ? 5000 : 10000;
          p.frozenUntil = Date.now() + freezeMs;
          socket.emit('strike', { strikes: p.strikes, freezeMs });
          socket.to(room.id).emit('opponentStrike', {r, c});
      }
    } else {
      let revealed = floodFill(room.masterGrid, r, c, p.openedGrid);
      p.progress += revealed.length;
      socket.emit('reveal', revealed);
      socket.to(room.id).emit('opponentPing', {r, c});
      updateProgress(room);

      if (p.progress === TOTAL_SAFE) {
          handleWin(room, socket.id, 'Cleared the Board!');
      }
    }
  });

  socket.on('flagCell', ({r, c}) => {
     if (!socket.roomId) return;
     const room = rooms[socket.roomId];
     if (!room || room.status !== 'playing') return;
     const p = room.players[socket.id];
     if (!p) return;
     if (p.openedGrid[r][c]) return;
     p.flagsGrid[r][c] = !p.flagsGrid[r][c];
     socket.emit('flagResult', {r, c, isFlagged: p.flagsGrid[r][c]});
  });

  socket.on('disconnect', () => {
    normalQueue = normalQueue.filter(id => id !== socket.id);
    rankedQueue = rankedQueue.filter(id => id !== socket.id);
    
    if (socket.roomId && rooms[socket.roomId]) {
        const room = rooms[socket.roomId];
        let winnerId = Object.keys(room.players).find(id => id !== socket.id);
        if (room.status === 'playing' && winnerId) {
            handleWin(room, winnerId, 'Opponent Disconnected');
        }
        delete rooms[socket.roomId];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
