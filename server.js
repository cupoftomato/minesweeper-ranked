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


// Game configurations
const MODES = {
  easy: { r: 8, c: 10, m: 10 },
  medium: { r: 14, c: 16, m: 35 },
  hard: { r: 18, c: 20, m: 75 }
};

const rooms = {};
const socketUsers = {}; 

// Queues mapped by mode
let normalQueue = { easy: [], medium: [], hard: [] };
let rankedQueue = { easy: [], medium: [], hard: [] };

function getElo(username) {
  if (!usersDB[username]) return 1200;
  return usersDB[username].elo;
}

function updateElo(winnerUser, loserUser) {
  if (!winnerUser || !loserUser || !usersDB[winnerUser] || !usersDB[loserUser]) return;
  let winnerElo = usersDB[winnerUser].elo;
  let loserElo = usersDB[loserUser].elo;
  let expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  let expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
  usersDB[winnerUser].elo = Math.round(winnerElo + 32 * (1 - expectedWinner));
  usersDB[loserUser].elo = Math.round(loserElo + 32 * (0 - expectedLoser));
  saveDB();
}

// Matchmaking Loop
setInterval(() => {
  ['easy', 'medium', 'hard'].forEach(diff => {
    let q = rankedQueue[diff];
    q.sort((a, b) => getElo(socketUsers[a]) - getElo(socketUsers[b]));
    while (q.length >= 2) {
      let p1 = q.shift();
      let p2 = q.shift();
      createMatch(p1, p2, 'ranked', diff);
    }
  });
}, 2000);

function createMatch(p1Id, p2Id, type, difficulty) {
  let roomId = crypto.randomUUID();
  const conf = MODES[difficulty];
  const TOTAL_SAFE = conf.r * conf.c - conf.m;
  
  rooms[roomId] = {
    id: roomId, type: type, diff: difficulty, conf: conf, players: {}, status: 'playing',
    masterGrid: generateMasterBoard(conf.r, conf.c, conf.m)
  };
  const room = rooms[roomId];
  const startCell = getSafeStart(room.masterGrid, conf.r, conf.c);

  [p1Id, p2Id].forEach(pid => {
    room.players[pid] = {
      id: pid, username: socketUsers[pid],
      openedGrid: Array(conf.r).fill().map(() => Array(conf.c).fill(false)),
      flagsGrid: Array(conf.r).fill().map(() => Array(conf.c).fill(false)),
      progress: 0, strikes: 0, frozenUntil: 0
    };
    
    let initialReveal = floodFill(room.masterGrid, startCell.r, startCell.c, room.players[pid].openedGrid, conf.r, conf.c);
    room.players[pid].progress = initialReveal.length;

    const sock = io.sockets.sockets.get(pid);
    if(sock) {
      sock.join(roomId); sock.roomId = roomId;
      let oppId = pid === p1Id ? p2Id : p1Id;
      sock.emit('matchFound', {
        roomId: roomId, type: type, diff: difficulty,
        myElo: getElo(socketUsers[pid]),
        oppElo: getElo(socketUsers[oppId]),
        oppName: socketUsers[oppId],
        rows: conf.r, cols: conf.c, totalSafe: TOTAL_SAFE
      });
      
      let revealed = [];
      for(let r=0; r<conf.r; r++)
          for(let c=0; c<conf.c; c++)
              if(room.players[pid].openedGrid[r][c]) revealed.push({r, c, val: room.masterGrid[r][c]});
      
      sock.emit('reveal', revealed);
    }
  });
  updateProgress(room);
}

function generateMasterBoard(ROWS, COLS, MINES) {
  let grid = Array(ROWS).fill().map(() => Array(COLS).fill(0));
  let minesPlaced = 0;
  while (minesPlaced < MINES) {
    let r = Math.floor(Math.random() * ROWS); let c = Math.floor(Math.random() * COLS);
    if (grid[r][c] !== -1) { grid[r][c] = -1; minesPlaced++; }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === -1) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (r+dr >= 0 && r+dr < ROWS && c+dc >= 0 && c+dc < COLS && grid[r+dr][c+dc] === -1) count++;
      grid[r][c] = count;
    }
  }
  return grid;
}

function floodFill(grid, r, c, openedGrid, ROWS, COLS) {
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

function getSafeStart(masterGrid, ROWS, COLS) {
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
    let wUser = room.players[winnerId].username;
    let lUser = room.players[loserId].username;
    let oldW = getElo(wUser); let oldL = getElo(lUser);
    
    updateElo(wUser, lUser);
    
    p1EloStr = ` (+${getElo(wUser) - oldW} Elo)`;
    p2EloStr = ` (${getElo(lUser) - oldL} Elo)`;
  }

  io.to(winnerId).emit('gameOver', { winner: winnerId, reason: reason + p1EloStr });
  if (loserId) io.to(loserId).emit('gameOver', { winner: winnerId, reason: reason + p2EloStr });
}

function removeFromAllQueues(socketId) {
  ['easy','medium','hard'].forEach(d => {
    normalQueue[d] = normalQueue[d].filter(id => id !== socketId);
    rankedQueue[d] = rankedQueue[d].filter(id => id !== socketId);
  });
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

  socket.on('findMatch', ({type, diff}) => {
    if (!socketUsers[socket.id] || !MODES[diff]) return;
    removeFromAllQueues(socket.id);

    if (type === 'normal') {
      normalQueue[diff].push(socket.id);
      if (normalQueue[diff].length >= 2) {
        let p1 = normalQueue[diff].shift(); let p2 = normalQueue[diff].shift();
        createMatch(p1, p2, 'normal', diff);
      }
    } else if (type === 'ranked') {
      rankedQueue[diff].push(socket.id);
    }
  });

  socket.on('cancelMatch', () => {
    removeFromAllQueues(socket.id);
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
      let revealed = floodFill(room.masterGrid, r, c, p.openedGrid, room.conf.r, room.conf.c);
      p.progress += revealed.length;
      socket.emit('reveal', revealed);
      socket.to(room.id).emit('opponentPing', {r, c});
      updateProgress(room);
      const TOTAL_SAFE = room.conf.r * room.conf.c - room.conf.m;
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
        }
        delete rooms[socket.roomId];
    }
    delete socketUsers[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
