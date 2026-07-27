const socket = io();

// DOM Elements - Screens
const authScreen = document.getElementById('auth-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');

// Auth DOM
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const authMessage = document.getElementById('authMessage');
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');

// Lobby DOM
const lobbyUsername = document.getElementById('lobbyUsername');
const lobbyElo = document.getElementById('lobbyElo');
const btnLogout = document.getElementById('btnLogout');
const diffSelect = document.getElementById('diffSelect');
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
const gameResultText = document.getElementById('gameResultText');
const btnReturnLobby = document.getElementById('btnReturnLobby');
const p1Bar = document.getElementById('p1-bar');
const p2Bar = document.getElementById('p2-bar');
const freezeOverlay = document.getElementById('freeze-overlay');
const myEloEl = document.getElementById('my-elo');
const oppEloEl = document.getElementById('opp-elo');
const oppNameEl = document.getElementById('opp-name');

let myId = null;
let myUsername = localStorage.getItem('ms_username') || '';
let myCurrentElo = 1200;

let boardCols = 16, boardRows = 16, totalSafe = 0;
let cells = [];
let timerInterval = null;
let startTime = 0;
let isFrozen = false;
let findingInterval = null;
let findTime = 0;

// ================= AUTHENTICATION =================
if (myUsername) {
  // Assume already logged in (no strict token validation for MVP)
  showLobby(myUsername, "Đang tải...");
  socket.emit('auth', myUsername);
}

socket.on('connect', () => {
  myId = socket.id;
  if (myUsername) {
    socket.emit('auth', myUsername);
  }
});

socket.on('authSuccess', (elo) => {
    myCurrentElo = elo;
    lobbyElo.innerText = elo;
});

async function handleAuth(action) {
    const user = usernameInput.value.trim();
    const pass = passwordInput.value.trim();
    if (!user || !pass) {
        authMessage.innerText = 'Vui lòng nhập tên và mật khẩu!';
        authMessage.classList.remove('hidden');
        return;
    }

    try {
        const res = await fetch(`/api/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        
        if (data.success) {
            myUsername = data.username;
            myCurrentElo = data.elo;
            localStorage.setItem('ms_username', myUsername);
            authScreen.classList.add('hidden');
            socket.emit('auth', myUsername);
            showLobby(myUsername, myCurrentElo);
        } else {
            authMessage.innerText = data.error;
            authMessage.classList.remove('hidden');
        }
    } catch (e) {
        authMessage.innerText = 'Lỗi kết nối Server!';
        authMessage.classList.remove('hidden');
    }
}

btnLogin.addEventListener('click', () => handleAuth('login'));
btnRegister.addEventListener('click', () => handleAuth('register'));

function showLobby(name, elo) {
    authScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
    lobbyUsername.innerText = name;
    lobbyElo.innerText = elo;
    
    // reset UI
    actionButtons.classList.remove('hidden');
    matchmakingStatus.classList.add('hidden');
    gameMessage.classList.add('hidden');
}

btnLogout.addEventListener('click', () => {
    myUsername = '';
    myCurrentElo = 1200;
    localStorage.removeItem('ms_username');
    socket.emit('logout'); // Tell server if needed, though disconnect is fine too
    lobbyScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
    usernameInput.value = '';
    passwordInput.value = '';
});

// ================= MATCHMAKING =================
function startMatchmaking(type) {
  const diff = diffSelect.value;
  actionButtons.classList.add('hidden');
  matchmakingStatus.classList.remove('hidden');
  
  socket.emit('findMatch', { type, diff });
  
  findTime = 0;
  statusText.innerText = `Đang tìm đối thủ (${diff.toUpperCase()})... 0s`;
  
  findingInterval = setInterval(() => {
    findTime++;
    statusText.innerText = `Đang tìm đối thủ (${diff.toUpperCase()})... ${findTime}s`;
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

// ================= GAME =================
socket.on('matchFound', (data) => {
  clearInterval(findingInterval);
  lobbyScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  
  boardCols = data.cols;
  boardRows = data.rows;
  totalSafe = data.totalSafe;
  oppNameEl.innerText = data.oppName;
  
  if (data.type === 'ranked') {
      myEloEl.innerText = `(Elo: ${data.myElo})`;
      oppEloEl.innerText = `(Elo: ${data.oppElo})`;
  } else {
      myEloEl.innerText = '';
      oppEloEl.innerText = '';
  }
  
  p1Bar.style.width = `50%`;
  p2Bar.style.width = `50%`;
  p1StrikesEl.innerText = `Lỗi: 0/3`;
  isFrozen = false;
  
  createBoard(data.rows, data.cols);
  
  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 10);
});

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
    gameResultText.innerText = `BẠN THẮNG! ${reason}`;
    gameResultText.style.color = 'var(--success)';
  } else {
    gameResultText.innerText = `BẠN THUA! ${reason}`;
    gameResultText.style.color = 'var(--danger)';
  }
  gameMessage.classList.remove('hidden');
  
  // Refresh elo from server
  socket.emit('auth', myUsername);
});

btnReturnLobby.addEventListener('click', () => {
    showLobby(myUsername, myCurrentElo);
});
