const socket = io();

// DOM Elements
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');

// Matchmaking
const btnNormal = document.getElementById('btnNormal');
const btnRanked = document.getElementById('btnRanked');
const actionButtons = document.getElementById('action-buttons');
const matchmakingStatus = document.getElementById('matchmaking-status');
const statusText = document.getElementById('status-text');
const btnCancel = document.getElementById('btnCancel');
const lobbyMessage = document.getElementById('lobbyMessage');

// Game UI
const boardEl = document.getElementById('minesweeper-board');
const p1StrikesEl = document.getElementById('p1-strikes');
const p2StatusEl = document.getElementById('p2-status');
const timerDisplay = document.getElementById('timerDisplay');
const gameMessage = document.getElementById('gameMessage');
const p1Bar = document.getElementById('p1-bar');
const p2Bar = document.getElementById('p2-bar');
const freezeOverlay = document.getElementById('freeze-overlay');
const myEloEl = document.getElementById('my-elo');
const oppEloEl = document.getElementById('opp-elo');

let myId = null;
let boardCols = 16, boardRows = 16, totalSafe = 0;
let cells = [];
let timerInterval = null;
let startTime = 0;
let isFrozen = false;
let findingInterval = null;
let findTime = 0;

// Connect
socket.on('connect', () => {
  myId = socket.id;
});

// Start Matchmaking
function startMatchmaking(type) {
  actionButtons.classList.add('hidden');
  matchmakingStatus.classList.remove('hidden');
  
  socket.emit('findMatch', type);
  
  findTime = 0;
  statusText.innerText = `Đang tìm đối thủ (${type.toUpperCase()})... 0s`;
  
  findingInterval = setInterval(() => {
    findTime++;
    statusText.innerText = `Đang tìm đối thủ (${type.toUpperCase()})... ${findTime}s`;
  }, 1000);
}

btnNormal.addEventListener('click', () => startMatchmaking('normal'));
btnRanked.addEventListener('click', () => startMatchmaking('ranked'));

btnCancel.addEventListener('click', () => {
  socket.emit('cancelMatch');
  clearInterval(findingInterval);
  matchmakingStatus.classList.add('hidden');
  actionButtons.classList.remove('hidden');
});

// Game Found
socket.on('matchFound', (data) => {
  clearInterval(findingInterval);
  lobbyScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  
  boardCols = data.cols;
  boardRows = data.rows;
  totalSafe = data.totalSafe;
  
  if (data.type === 'ranked') {
      myEloEl.innerText = `(Elo: ${data.myElo})`;
      oppEloEl.innerText = `(Elo: ${data.oppElo})`;
  } else {
      myEloEl.innerText = '';
      oppEloEl.innerText = '';
  }
  
  createBoard(data.rows, data.cols);
  
  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 10);
});

// Create HTML Grid
function createBoard(r, c) {
  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${c}, 32px)`;
  boardEl.style.gridTemplateRows = `repeat(${r}, 32px)`;
  cells = Array(r).fill().map(() => Array(c).fill(null));

  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.r = i;
      cell.dataset.c = j;
      
      cell.addEventListener('mousedown', (e) => {
        if (isFrozen) return;
        if (e.button === 0) {
          socket.emit('clickCell', {r: i, c: j});
        } else if (e.button === 2) {
          socket.emit('flagCell', {r: i, c: j});
        }
      });
      
      cell.addEventListener('contextmenu', e => e.preventDefault());
      
      boardEl.appendChild(cell);
      cells[i][j] = cell;
    }
  }
}

function updateTimer() {
  const now = Date.now();
  const diff = now - startTime;
  const mins = Math.floor(diff / 60000).toString().padStart(2, '0');
  const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
  const ms = (diff % 1000).toString().padStart(3, '0');
  timerDisplay.innerText = `${mins}:${secs}.${ms}`;
}

// Handle reveals
socket.on('reveal', (revealedArr) => {
  revealedArr.forEach(item => {
    const {r, c, val} = item;
    const el = cells[r][c];
    if (!el.classList.contains('open')) {
      el.classList.add('open');
      el.classList.remove('flag');
      el.innerText = val > 0 ? val : (val === -1 ? '💣' : '');
      if (val > 0) el.classList.add(`val-${val}`);
    }
  });
});

// Handle flagging
socket.on('flagResult', ({r, c, isFlagged}) => {
  const el = cells[r][c];
  if (isFlagged) {
    el.classList.add('flag');
    el.innerText = '🚩';
  } else {
    el.classList.remove('flag');
    el.innerText = '';
  }
});

// Update Progress Bars
socket.on('progressUpdate', (prog) => {
  let myProg = prog[myId] || 0;
  let oppProg = 0;
  for(let pid in prog) {
    if(pid !== myId) oppProg = prog[pid];
  }

  let total = Math.max(myProg + oppProg, 1);
  let balance = 50 + ((myProg - oppProg) / totalSafe) * 50;
  p1Bar.style.width = `${balance}%`;
  p2Bar.style.width = `${100 - balance}%`;
});

// Strikes & Freeze
socket.on('strike', ({strikes, freezeMs}) => {
  p1StrikesEl.innerText = `Lỗi: ${strikes}/3`;
  document.querySelector('.board-container').classList.add('shake');
  setTimeout(() => document.querySelector('.board-container').classList.remove('shake'), 500);

  isFrozen = true;
  freezeOverlay.innerText = `PHẠT LỖI: ĐÓNG BĂNG ${(freezeMs/1000).toFixed(1)}s`;
  freezeOverlay.classList.remove('hidden');
  
  let left = freezeMs / 1000;
  let intv = setInterval(() => {
    left -= 0.1;
    if (left <= 0) {
      clearInterval(intv);
      freezeOverlay.classList.add('hidden');
      isFrozen = false;
    } else {
      freezeOverlay.innerText = `PHẠT LỖI: ĐÓNG BĂNG ${left.toFixed(1)}s`;
    }
  }, 100);
});

socket.on('opponentStrike', ({r, c}) => {
  p2StatusEl.innerText = 'Đang bị đóng băng!';
  p2StatusEl.style.color = '#ef4444';
  
  if(cells[r][c]) {
    cells[r][c].classList.add('ping');
    setTimeout(() => cells[r][c].classList.remove('ping'), 500);
  }

  setTimeout(() => {
    p2StatusEl.innerText = 'Bình thường';
    p2StatusEl.style.color = 'inherit';
  }, 5000);
});

socket.on('opponentPing', ({r, c}) => {});

socket.on('gameOver', ({winner, reason}) => {
  clearInterval(timerInterval);
  isFrozen = true;
  
  if (winner === myId) {
    gameMessage.innerText = `BẠN THẮNG! ${reason}`;
    gameMessage.style.color = 'var(--success)';
  } else {
    gameMessage.innerText = `BẠN THUA! ${reason}`;
    gameMessage.style.color = 'var(--danger)';
  }
  gameMessage.classList.remove('hidden');
});
