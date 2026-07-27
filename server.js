const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const USERS_FILE = path.join(__dirname, 'users.json');
let usersDB = {};

if (fs.existsSync(USERS_FILE)) {
    try { usersDB = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
    catch (e) { usersDB = {}; }
}
function saveDB() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersDB, null, 2));
}
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Auth APIs
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || username.length < 3) return res.status(400).json({ error: 'Username/Password không hợp lệ!' });
    if (usersDB[username]) return res.status(400).json({ error: 'Tên tài khoản đã tồn tại!' });
    usersDB[username] = { password: hashPassword(password), elo: 1200 };
    saveDB();
    res.json({ success: true, username, elo: 1200 });
});
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = usersDB[username];
    if (!user || user.password !== hashPassword(password)) return res.status(400).json({ error: 'Tài khoản/Mật khẩu không đúng!' });
    res.json({ success: true, username, elo: user.elo });
});

// Game Config
const ROWS = 16, COLS = 16, MINES = 50;
const TOTAL_SAFE = ROWS * COLS - MINES;
const SEED_TYPES = ['Open', 'Isolated', 'Edge-Heavy', 'Center-Heavy', 'Linear', 'Symmetric', 'Trap'];

const rooms = {};
const socketUsers = {}; 

let normalQueue = [];
let rankedQueue = [];

function getElo(username) {
  return usersDB[username] ? usersDB[username].elo : 1200;
}
function updateElo(winnerUser, loserUser) {
  if (!winnerUser || !loserUser || !usersDB[winnerUser] || !usersDB[loserUser]) return;
  let wE = usersDB[winnerUser].elo, lE = usersDB[loserUser].elo;
  let expectedW = 1 / (1 + Math.pow(10, (lE - wE) / 400));
  let expectedL = 1 / (1 + Math.pow(10, (wE - lE) / 400));
  usersDB[winnerUser].elo = Math.round(wE + 32 * (1 - expectedW));
  usersDB[loserUser].elo = Math.round(lE + 32 * (0 - expectedL));
  saveDB();
}

// Matchmaking
setInterval(() => {
  rankedQueue.sort((a, b) => getElo(socketUsers[a]) - getElo(socketUsers[b]));
  while (rankedQueue.length >= 2) {
    let p1 = rankedQueue.shift(); let p2 = rankedQueue.shift();
    createIntermission(p1, p2, 'ranked');
  }
}, 2000);

function getRandomSeedType() {
    return SEED_TYPES[Math.floor(Math.random() * SEED_TYPES.length)];
}

function createIntermission(p1Id, p2Id, type) {
  let roomId = crypto.randomUUID();
  let seedType = getRandomSeedType();
  
  rooms[roomId] = {
    id: roomId, type: type, seedType: seedType, players: {}, status: 'intermission',
    votes: {}, skipTimer: null
  };
  const room = rooms[roomId];

  [p1Id, p2Id].forEach(pid => {
    room.players[pid] = { id: pid, username: socketUsers[pid], openedGrid: [], flagsGrid: [], progress: 0, strikes: 0, frozenUntil: 0 };
    const sock = io.sockets.sockets.get(pid);
    if(sock) {
      sock.join(roomId); sock.roomId = roomId;
      let oppId = pid === p1Id ? p2Id : p1Id;
      sock.emit('intermission_start', {
        roomId: roomId, seedType: room.seedType,
        myElo: getElo(socketUsers[pid]), oppElo: getElo(socketUsers[oppId]), oppName: socketUsers[oppId]
      });
    }
  });

  startIntermissionTimer(room);
}

function startIntermissionTimer(room) {
    let timeLeft = 10;
    io.to(room.id).emit('intermission_tick', timeLeft);
    room.skipTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(room.skipTimer);
            startGame(room);
        } else {
            io.to(room.id).emit('intermission_tick', timeLeft);
        }
    }, 1000);
}

function handleVoteSkip(room, socketId) {
    room.votes[socketId] = true;
    let pCount = Object.keys(room.players).length;
    let vCount = Object.keys(room.votes).length;
    
    io.to(room.id).emit('vote_update', { votes: vCount, total: pCount });
    
    if (vCount === pCount) {
        clearInterval(room.skipTimer);
        let oldSeed = room.seedType;
        while(room.seedType === oldSeed) { room.seedType = getRandomSeedType(); }
        room.votes = {};
        io.to(room.id).emit('intermission_start', {
            roomId: room.id, seedType: room.seedType,
            myElo: 0, oppElo: 0, oppName: '...' // minimal re-emit
        });
        startIntermissionTimer(room);
    }
}

function startGame(room) {
    room.status = 'playing';
    room.masterGrid = generateMasterBoard(room.seedType);
    const startCell = getSafeStart(room.masterGrid);

    for(let pid in room.players) {
        let p = room.players[pid];
        p.openedGrid = Array(ROWS).fill().map(() => Array(COLS).fill(false));
        p.flagsGrid = Array(ROWS).fill().map(() => Array(COLS).fill(false));
        p.progress = 0; p.strikes = 0; p.frozenUntil = 0;
        
        let initialReveal = floodFill(room.masterGrid, startCell.r, startCell.c, p.openedGrid);
        p.progress += initialReveal.length;
        
        const sock = io.sockets.sockets.get(pid);
        if(sock) {
            sock.emit('game_start', { rows: ROWS, cols: COLS, totalSafe: TOTAL_SAFE, startReveal: initialReveal });
        }
    }
    updateProgress(room);
}

// ================= SEED GENERATORS =================
function generateMasterBoard(type) {
  let grid = Array(ROWS).fill().map(() => Array(COLS).fill(0));
  let minesPlaced = 0;

  function countNeighbors(r, c) {
      let cnt = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (r+dr >= 0 && r+dr < ROWS && c+dc >= 0 && c+dc < COLS && grid[r+dr][c+dc] === -1) cnt++;
      return cnt;
  }

  while (minesPlaced < MINES) {
      let r, c;
      if (type === 'Edge-Heavy' && minesPlaced < 40) {
          if (Math.random() > 0.5) {
              r = Math.random() > 0.5 ? Math.floor(Math.random()*2) : ROWS - 1 - Math.floor(Math.random()*2);
              c = Math.floor(Math.random()*COLS);
          } else {
              c = Math.random() > 0.5 ? Math.floor(Math.random()*2) : COLS - 1 - Math.floor(Math.random()*2);
              r = Math.floor(Math.random()*ROWS);
          }
      } else if (type === 'Center-Heavy' && minesPlaced < 40) {
          r = 4 + Math.floor(Math.random() * 8);
          c = 4 + Math.floor(Math.random() * 8);
      } else if (type === 'Symmetric' && minesPlaced < 25) {
          r = Math.floor(Math.random() * ROWS);
          c = Math.floor(Math.random() * (COLS/2)); // Left half
      } else if (type === 'Symmetric' && minesPlaced >= 25) {
          break; // Handles mirroring later
      } else if (type === 'Linear') {
          // Walk
          if (minesPlaced === 0 || Math.random() < 0.1) {
              r = Math.floor(Math.random() * ROWS); c = Math.floor(Math.random() * COLS);
          } else {
              // try to step
              let lastR = -1, lastC = -1;
              for(let i=0;i<ROWS;i++) for(let j=0;j<COLS;j++) if(grid[i][j]===-1){lastR=i;lastC=j;}
              const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
              let dir = dirs[Math.floor(Math.random()*dirs.length)];
              r = Math.max(0, Math.min(ROWS-1, lastR + dir[0]));
              c = Math.max(0, Math.min(COLS-1, lastC + dir[1]));
          }
      } else if (type === 'Trap' && minesPlaced < 12) {
          // Place 2x2 blocks against walls
          r = Math.random() > 0.5 ? 0 : ROWS-2;
          c = Math.floor(Math.random() * (COLS-2));
          if (grid[r][c] !== -1) { grid[r][c] = -1; minesPlaced++; }
          if (grid[r][c+1] !== -1) { grid[r][c+1] = -1; minesPlaced++; }
          if (grid[r+1][c] !== -1) { grid[r+1][c] = -1; minesPlaced++; }
          if (grid[r+1][c+1] !== -1) { grid[r+1][c+1] = -1; minesPlaced++; }
          continue;
      } else {
          r = Math.floor(Math.random() * ROWS);
          c = Math.floor(Math.random() * COLS);
      }

      if (grid[r][c] === -1) continue;

      if (type === 'Isolated' && countNeighbors(r, c) > 0) continue;
      if (type === 'Open' && countNeighbors(r, c) >= 1) {
          // allow max 1 neighbor
          if (Math.random() < 0.8) continue; 
      }

      grid[r][c] = -1;
      minesPlaced++;
      
      if (type === 'Symmetric') {
          grid[r][COLS - 1 - c] = -1;
          minesPlaced++;
      }
  }

  // Calculate numbers
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === -1) continue;
      grid[r][c] = countNeighbors(r, c);
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
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (curr.r+dr >= 0 && curr.r+dr < ROWS && curr.c+dc >= 0 && curr.c+dc < COLS && !openedGrid[curr.r+dr][curr.c+dc]) 
            queue.push({r: curr.r+dr, c: curr.c+dc});
    }
  }
  return revealed;
}

function getSafeStart(masterGrid) {
  let safeCells = [];
  for(let r=0; r<ROWS; r++) for(let c=0; c<COLS; c++) if(masterGrid[r][c] === 0) safeCells.push({r, c});
  if(safeCells.length===0) for(let r=0; r<ROWS; r++) for(let c=0; c<COLS; c++) if(masterGrid[r][c] !== -1) safeCells.push({r, c});
  return safeCells[Math.floor(Math.random() * safeCells.length)];
}

function updateProgress(room) {
  const prog = {};
  for(let pid in room.players) prog[pid] = room.players[pid].progress;
  io.to(room.id).emit('progressUpdate', prog);
}

function handleWin(room, winnerId, reason) {
  if (room.status === 'ended') return;
  room.status = 'ended';
  let loserId = Object.keys(room.players).find(id => id !== winnerId);
  let p1EloStr = "", p2EloStr = "";
  if (room.type === 'ranked' && loserId) {
    let wUser = room.players[winnerId].username, lUser = room.players[loserId].username;
    let oldW = getElo(wUser), oldL = getElo(lUser);
    updateElo(wUser, lUser);
    p1EloStr = ` (+${getElo(wUser) - oldW} Elo)`;
    p2EloStr = ` (${getElo(lUser) - oldL} Elo)`;
  }
  io.to(winnerId).emit('gameOver', { winner: winnerId, reason: reason + p1EloStr });
  if (loserId) io.to(loserId).emit('gameOver', { winner: winnerId, reason: reason + p2EloStr });
}

function removeFromAllQueues(socketId) {
    normalQueue = normalQueue.filter(id => id !== socketId);
    rankedQueue = rankedQueue.filter(id => id !== socketId);
}

io.on('connection', (socket) => {
  socket.on('auth', (username) => {
      socketUsers[socket.id] = username;
      socket.emit('authSuccess', getElo(username));
  });

  socket.on('logout', () => {
      delete socketUsers[socket.id];
      removeFromAllQueues(socket.id);
  });

  socket.on('findMatch', (type) => {
    if (!socketUsers[socket.id]) return;
    removeFromAllQueues(socket.id);
    if (type === 'normal') {
      normalQueue.push(socket.id);
      if (normalQueue.length >= 2) {
        createIntermission(normalQueue.shift(), normalQueue.shift(), 'normal');
      }
    } else if (type === 'ranked') {
      rankedQueue.push(socket.id);
    }
  });

  socket.on('cancelMatch', () => removeFromAllQueues(socket.id));
  
  socket.on('voteSkip', () => {
      if (!socket.roomId) return;
      const room = rooms[socket.roomId];
      if (room && room.status === 'intermission') handleVoteSkip(room, socket.id);
  });
  
  socket.on('chat_msg', (msg) => {
      if (!socket.roomId || !socketUsers[socket.id] || !msg) return;
      io.to(socket.roomId).emit('chat_msg', { user: socketUsers[socket.id], text: msg });
  });

  socket.on('clickCell', ({r, c}) => {
    if (!socket.roomId) return;
    const room = rooms[socket.roomId];
    if (!room || room.status !== 'playing') return;
    const p = room.players[socket.id];
    if (!p || Date.now() < p.frozenUntil || p.openedGrid[r][c] || p.flagsGrid[r][c]) return;

    const val = room.masterGrid[r][c];
    if (val === -1) {
      p.strikes++;
      if (p.strikes >= 3) {
          let winnerId = Object.keys(room.players).find(id => id !== socket.id);
          handleWin(room, winnerId, 'Đối thủ nổ 3 quả mìn!');
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
      if (p.progress === TOTAL_SAFE) handleWin(room, socket.id, 'Hoàn thành bản đồ!');
    }
  });

  socket.on('flagCell', ({r, c}) => {
     if (!socket.roomId) return;
     const room = rooms[socket.roomId];
     if (!room || room.status !== 'playing') return;
     const p = room.players[socket.id];
     if (!p || p.openedGrid[r][c]) return;
     p.flagsGrid[r][c] = !p.flagsGrid[r][c];
     socket.emit('flagResult', {r, c, isFlagged: p.flagsGrid[r][c]});
  });

  socket.on('disconnect', () => {
    removeFromAllQueues(socket.id);
    if (socket.roomId && rooms[socket.roomId]) {
        const room = rooms[socket.roomId];
        let winnerId = Object.keys(room.players).find(id => id !== socket.id);
        if (room.status === 'playing' && winnerId) {
            handleWin(room, winnerId, 'Đối thủ mất kết nối!');
        } else if (room.status === 'intermission') {
            clearInterval(room.skipTimer);
            if(winnerId) {
                io.to(winnerId).emit('gameOver', {winner: winnerId, reason: 'Đối thủ thoát khi chờ.'});
            }
        }
        delete rooms[socket.roomId];
    }
    delete socketUsers[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Server on port ${PORT}`); });
