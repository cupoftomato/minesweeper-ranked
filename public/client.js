const socket = io();

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const intermissionScreen = document.getElementById('intermission-screen');
const gameScreen = document.getElementById('game-screen');

const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const authMessage = document.getElementById('authMessage');
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');

const lobbyUsername = document.getElementById('lobbyUsername');
const lobbyElo = document.getElementById('lobbyElo');
const btnLogout = document.getElementById('btnLogout');
const btnNormal = document.getElementById('btnNormal');
const btnRanked = document.getElementById('btnRanked');
const actionButtons = document.getElementById('action-buttons');
const matchmakingStatus = document.getElementById('matchmaking-status');
const statusText = document.getElementById('status-text');
const btnCancel = document.getElementById('btnCancel');
const lobbyMessage = document.getElementById('lobbyMessage');

// Intermission DOM
const intMyName = document.getElementById('int-my-name');
const intMyElo = document.getElementById('int-my-elo');
const intOppName = document.getElementById('int-opp-name');
const intOppElo = document.getElementById('int-opp-elo');
const seedNameDisplay = document.getElementById('seed-name-display');
const intermissionTimer = document.getElementById('intermission-timer');
const btnVoteSkip = document.getElementById('btnVoteSkip');
const voteStatusText = document.getElementById('vote-status-text');
const seedBg = document.getElementById('seed-background');

// Game UI
const boardEl = document.getElementById('minesweeper-board');
const p1StrikesEl = document.getElementById('p1-strikes');
const p2StatusEl = document.getElementById('p2-status');
const timerDisplay = document.getElementById('timerDisplay');
const gameResultText = document.getElementById('gameResultText');
const btnReturnLobby = document.getElementById('btnReturnLobby');
const p1Bar = document.getElementById('p1-bar');
const p2Bar = document.getElementById('p2-bar');
const freezeOverlay = document.getElementById('freeze-overlay');
const myEloEl = document.getElementById('my-elo');
const oppEloEl = document.getElementById('opp-elo');
const oppNameEl = document.getElementById('opp-name');

// Chat UI
const chatContainer = document.getElementById('chat-container');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');

const btnSurrender = document.getElementById('btnSurrender');
const btnOfferDraw = document.getElementById('btnOfferDraw');
const btnVoteSeed = document.getElementById('btnVoteSeed');
const actionRequestsContainer = document.getElementById('action-requests-container');

const btnSetBg = document.getElementById('btnSetBg');
const btnSeedBook = document.getElementById('btnSeedBook');
const seedBookModal = document.getElementById('seed-book-modal');
const btnCloseSeedBook = document.getElementById('btnCloseSeedBook');
const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardList = document.getElementById('leaderboard-list');

const normalSeedSelector = document.getElementById('normal-seed-selector');
const btnSeedSelects = document.querySelectorAll('.btn-seed-select');

let myId = null;
let myUsername = localStorage.getItem('ms_username') || '';
let myCurrentElo = parseInt(localStorage.getItem('ms_elo')) || 1200;
let myCustomBg = localStorage.getItem('ms_bg') || '';

if (myCustomBg) {
    document.body.style.backgroundImage = `url('${myCustomBg}')`;
    document.body.style.backgroundSize = 'cover';
}

let boardCols = 16, boardRows = 16, totalSafe = 0;
let cells = [];
let findTime = 0;
let findingInterval;
let myPing = 0;

const GAME_TIPS = [
    "💡 Mẹo: Seed 'Open' là nơi đọ tốc độ tay (CPS), hãy tận dụng kỹ năng Click Đúp (Chording) thật nhiều!",
    "💡 Sự thật: Trò chơi Minesweeper nguyên bản được phát triển từ thập niên 1980.",
    "💡 Sự thật: Kỷ lục thế giới giải Minesweeper bảng Khó (Expert) hiện tại chưa tới 30 giây!",
    "💡 Mẹo: Nếu bạn thấy số 1 ở góc tường, thì ô chéo duy nhất của nó chắn chắn là mìn.",
    "💡 Mẹo: Đấu Hạng (Ranked) sẽ trừ rất nhiều điểm Elo nếu bạn đầu hàng, hãy cân nhắc trước khi bỏ cuộc!",
    "💡 Sự thật: Trò chơi này từng bị Microsoft định gỡ bỏ vì... chính Bill Gates cũng từng nghiện nó.",
    "💡 Mẹo: Seed 'Center-Heavy' có mìn tập trung rất dày ở tâm, hãy bắt đầu từ viền ngoài để đảm bảo an toàn.",
    "💡 Mẹo: Nhấn giữ phím TAB bất cứ lúc nào để xem danh sách những cao thủ đang Online.",
    "💡 Sự thật: Số 8 là con số lớn nhất bạn có thể gặp trong trò chơi, nghĩa là bạn đang bị bủa vây hoàn toàn!",
    "💡 Mẹo: Nếu 2 người chơi cùng cắm cờ sai và nổ mìn quá 3 lần, ai nổ lần 3 trước người đó sẽ bị xử thua.",
    "💡 Sự thật: Minesweeper Ranked được tạo ra bởi AI Antigravity!"
];
let isFrozen = false;
let timerInterval = null;
let startTime = 0;

// ================= AUTHENTICATION =================
if (myUsername) {
  showLobby(myUsername, "Đang tải...");
  socket.emit('auth', { username: myUsername, elo: myCurrentElo });
}

socket.on('connect', () => {
  myId = socket.id;
  if (myUsername) socket.emit('auth', { username: myUsername, elo: myCurrentElo });
});

socket.on('authSuccess', (elo) => {
    myCurrentElo = elo;
    localStorage.setItem('ms_elo', elo);
    lobbyElo.innerText = elo;
});

async function handleAuth(action) {
    const user = usernameInput.value.trim();
    const pass = passwordInput.value.trim();
    if (!user || !pass) {
        authMessage.innerText = 'Vui lòng nhập tên và mật khẩu!';
        authMessage.classList.remove('hidden'); return;
    }
    try {
        const res = await fetch(`/api/${action}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.success) {
            myUsername = data.username; myCurrentElo = data.elo;
            localStorage.setItem('ms_username', myUsername);
            localStorage.setItem('ms_elo', myCurrentElo);
            authScreen.classList.add('hidden');
            socket.emit('auth', { username: myUsername, elo: myCurrentElo });
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
    authScreen.classList.add('hidden'); gameScreen.classList.add('hidden'); intermissionScreen.classList.add('hidden'); chatContainer.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
    lobbyUsername.innerText = name; lobbyElo.innerText = elo;
    actionButtons.classList.remove('hidden'); matchmakingStatus.classList.add('hidden');
}

btnSetBg.addEventListener('click', () => {
    const url = prompt("Nhập đường link ảnh nền (URL):", myCustomBg);
    if (url !== null) {
        myCustomBg = url.trim();
        if (myCustomBg) {
            localStorage.setItem('ms_bg', myCustomBg);
            document.body.style.backgroundImage = `url('${myCustomBg}')`;
            document.body.style.backgroundSize = 'cover';
        } else {
            localStorage.removeItem('ms_bg');
            document.body.style.backgroundImage = '';
        }
    }
});

btnSeedBook.addEventListener('click', () => seedBookModal.classList.remove('hidden'));
btnCloseSeedBook.addEventListener('click', () => seedBookModal.classList.add('hidden'));

// TAB KEY LEADERBOARD
document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        leaderboardModal.classList.remove('hidden');
    }
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'Tab') {
        leaderboardModal.classList.add('hidden');
    }
});

socket.on('serverStats', (stats) => {
    document.getElementById('online-count').innerText = stats.onlineUsers.length;
    document.getElementById('ranked-q-count').innerText = stats.queueStats.ranked;
    document.getElementById('normal-q-count').innerText = stats.queueStats.normal;
    
    leaderboardList.innerHTML = '';
    stats.onlineUsers.forEach((u, idx) => {
        let div = document.createElement('div');
        div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.padding = '8px'; div.style.background = 'rgba(0,0,0,0.4)'; div.style.borderRadius = '4px';
        div.innerHTML = `<span><strong style="color:var(--accent)">#${idx+1}</strong> ${u.username}</span> <span class="gold-text">${u.elo}</span>`;
        leaderboardList.appendChild(div);
    });
});

btnLogout.addEventListener('click', () => {
    myUsername = ''; myCurrentElo = 1200;
    localStorage.removeItem('ms_username');
    localStorage.removeItem('ms_elo');
    socket.emit('logout');
    lobbyScreen.classList.add('hidden'); authScreen.classList.remove('hidden');
    usernameInput.value = ''; passwordInput.value = '';
});

// ================= MATCHMAKING =================
btnRanked.addEventListener('click', () => {
  socket.emit('findMatch', 'ranked');
  actionButtons.classList.add('hidden');
  matchmakingStatus.classList.remove('hidden');
});
btnNormal.addEventListener('click', () => {
  socket.emit('findMatch', 'normal');
  actionButtons.classList.add('hidden');
  matchmakingStatus.classList.remove('hidden');
});
btnCancel.addEventListener('click', () => {
  socket.emit('cancelMatch');
  actionButtons.classList.remove('hidden');
  matchmakingStatus.classList.remove('hidden');
});

// ================= INTERMISSION =================
socket.on('intermission_start', (data) => {
    lobbyScreen.classList.add('hidden'); chatContainer.classList.add('hidden');
    intermissionScreen.classList.remove('hidden');
    
    document.getElementById('int-my-name').innerText = myUsername;
    document.getElementById('int-my-elo').innerText = data.myElo;
    document.getElementById('int-opp-name').innerText = data.oppName;
    document.getElementById('int-opp-elo').innerText = data.oppElo;
    
    // Pick random tip
    document.getElementById('intermission-tip').innerText = GAME_TIPS[Math.floor(Math.random() * GAME_TIPS.length)];
    
    seedNameDisplay.innerText = data.seedType === 'Random' ? 'ĐANG CHỌN...' : data.seedType + ' SEED';
    if(data.seedType !== 'Random') seedBg.style.backgroundImage = `url(${generateCanvasSeed(data.seedType)})`;
    else seedBg.style.backgroundImage = '';
    
    btnVoteSkip.disabled = false;
    btnVoteSkip.innerText = "ĐỔI SEED KHÁC";
    btnVoteSkip.classList.remove('locked');
    document.getElementById('vote-status-text').innerText = '0/2 người muốn đổi';
    
    if (data.type === 'normal') {
        btnVoteSkip.classList.add('hidden');
        document.getElementById('vote-status-text').classList.add('hidden');
        normalSeedSelector.classList.remove('hidden');
        btnSeedSelects.forEach(btn => {
            btn.classList.remove('locked');
            let s = btn.getAttribute('data-seed');
            if (s !== 'Random') btn.style.backgroundImage = `url(${generateCanvasSeed(s)})`;
            if (data.pickerId === null || data.pickerId === myId) {
                btn.onclick = () => socket.emit('selectNormalSeed', s);
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            } else {
                btn.onclick = null;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        });
    } else {
        btnVoteSkip.classList.remove('hidden');
        document.getElementById('vote-status-text').classList.remove('hidden');
        normalSeedSelector.classList.add('hidden');
    }
});

socket.on('normalSeedLocked', (seed) => {
    seedNameDisplay.innerText = seed + ' SEED';
    seedBg.style.backgroundImage = `url(${generateCanvasSeed(seed)})`;
    btnSeedSelects.forEach(btn => {
        if (btn.getAttribute('data-seed') === seed) btn.classList.add('locked');
        btn.onclick = null;
    });
});

socket.on('intermission_tick', (timeLeft) => {
    intermissionTimer.innerText = timeLeft;
});

btnVoteSkip.addEventListener('click', () => {
    socket.emit('voteSkip');
    btnVoteSkip.disabled = true;
    btnVoteSkip.innerText = "ĐÃ VOTE";
});

socket.on('vote_update', ({votes, total}) => {
    voteStatusText.innerText = `${votes}/${total} người muốn đổi`;
});


function generateCanvasSeed(type) {
    const canvas = document.createElement('canvas');
    const cols = 16, rows = 16;
    const cellSize = 10;
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
    const ctx = canvas.getContext('2d');
    
    // Background color
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw cells
    for(let r=0; r<rows; r++) {
        for(let c=0; c<cols; c++) {
            let isMine = false;
            // Rough simulation of algorithms for visual representation
            if(type === 'Edge-Heavy') {
                if(r<2 || r>=14 || c<2 || c>=14) isMine = Math.random() > 0.3;
            } else if(type === 'Center-Heavy') {
                if(r>=4 && r<12 && c>=4 && c<12) isMine = Math.random() > 0.3;
            } else if(type === 'Linear') {
                if(c === r || c === 15-r) isMine = true;
            } else if(type === 'Symmetric') {
                isMine = (c<8 && Math.random()>0.8) ? true : false;
                // Mirrors handled poorly here but we just use random for visual
                if(Math.random()>0.8) isMine = true; 
            } else if(type === 'Trap') {
                if((r%4===0 && c%4===0)) isMine = true;
            } else {
                isMine = Math.random() > 0.8;
            }

            ctx.fillStyle = isMine ? '#ef4444' : '#334155';
            ctx.fillRect(c*cellSize, r*cellSize, cellSize-1, cellSize-1);
        }
    }
    return canvas.toDataURL('image/png');
}

// ================= GAME =================
socket.on('game_start', (data) => {
  intermissionScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  chatContainer.classList.remove('hidden'); // Show chat box
  chatMessages.innerHTML = '';
  addSysMsg('Trận đấu bắt đầu! Ấn Enter để chat.');
  
  boardCols = data.cols;
  boardRows = data.rows;
  totalSafe = data.totalSafe;
  
  p1Bar.style.width = `50%`; p2Bar.style.width = `50%`;
  p1StrikesEl.innerText = `Lỗi: 0/3`;
  isFrozen = false;
  
  // Reset UI elements
  btnSurrender.classList.remove('hidden');
  btnOfferDraw.classList.remove('hidden');
  btnOfferDraw.disabled = false; btnOfferDraw.innerText = "Xin Hòa";
  btnVoteSeed.classList.remove('hidden');
  btnVoteSeed.disabled = false; btnVoteSeed.innerText = "Đổi Seed";
  document.getElementById('btnReturnLobby').classList.add('hidden');
  
  document.getElementById('ingame-seed-name').innerText = data.seedType + ' SEED';
  document.getElementById('ingame-seed-icon').style.backgroundImage = `url(${generateCanvasSeed(data.seedType)})`;
  actionRequestsContainer.innerHTML = '';
  
  createBoard(data.rows, data.cols);
  
  // Apply initial reveal
  data.startReveal.forEach(item => {
    const el = cells[item.r][item.c];
    el.classList.add('open');
    el.innerText = item.val > 0 ? item.val : '';
    if (item.val > 0) el.classList.add(`val-${item.val}`);
  });
  
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
      cell.dataset.r = i; cell.dataset.c = j;
      
      cell.addEventListener('mousedown', (e) => {
        if (isFrozen) return;
        if (e.button === 0) {
            // If already open, chord. Else normal click.
            if (cell.classList.contains('open')) {
                socket.emit('chordCell', {r: i, c: j});
            } else {
                socket.emit('clickCell', {r: i, c: j});
            }
        }
        else if (e.button === 2) socket.emit('flagCell', {r: i, c: j});
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
    const el = cells[item.r][item.c];
    if (!el.classList.contains('open')) {
      el.classList.add('open'); el.classList.remove('flag');
      el.innerText = item.val > 0 ? item.val : (item.val === -1 ? '💣' : '');
      if (item.val > 0) el.classList.add(`val-${item.val}`);
    }
  });
});

socket.on('flagResult', ({r, c, isFlagged}) => {
  const el = cells[r][c];
  if (isFlagged) { el.classList.add('flag'); el.innerText = '🚩'; } 
  else { el.classList.remove('flag'); el.innerText = ''; }
});

socket.on('progressUpdate', (prog) => {
  let myProg = prog[myId] || 0;
  let oppProg = 0;
  for(let pid in prog) if(pid !== myId) oppProg = prog[pid];
  let total = Math.max(myProg + oppProg, 1);
  let balance = 50 + ((myProg - oppProg) / totalSafe) * 50;
  p1Bar.style.width = `${balance}%`; p2Bar.style.width = `${100 - balance}%`;
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
      clearInterval(intv); freezeOverlay.classList.add('hidden'); isFrozen = false;
    } else {
      freezeOverlay.innerText = `PHẠT LỖI: ĐÓNG BĂNG ${left.toFixed(1)}s`;
    }
  }, 100);
});

socket.on('opponentStrike', ({r, c}) => {
  p2StatusEl.innerText = 'Đang bị đóng băng!'; p2StatusEl.style.color = '#ef4444';
  if(cells[r][c]) {
    cells[r][c].classList.add('ping');
    setTimeout(() => cells[r][c].classList.remove('ping'), 500);
  }
  setTimeout(() => {
    p2StatusEl.innerText = 'Bình thường'; p2StatusEl.style.color = 'inherit';
  }, 5000);
});

socket.on('opponentPing', ({r, c}) => {});

socket.on('gameOver', ({winner, reason, fullGrid}) => {
  clearInterval(timerInterval);
  isFrozen = true;
  
  if (fullGrid) {
      for (let i = 0; i < boardRows; i++) {
          for (let j = 0; j < boardCols; j++) {
              if (fullGrid[i][j] === -1) {
                  cells[i][j].classList.add('open');
                  if (!cells[i][j].classList.contains('flag')) {
                      cells[i][j].innerText = '💣';
                  }
              }
          }
      }
  }
  
  const gameOverOverlay = document.getElementById('game-over-overlay');
  if (winner === myId) {
    gameResultText.innerHTML = `MATCH ENDED<br><span style="font-size:2rem; color:var(--success)">Bạn Thắng!<br><span style="font-size:1.2rem">${reason}</span></span>`; 
  } else if (winner === null) {
    gameResultText.innerHTML = `MATCH ENDED<br><span style="font-size:2rem; color:#facc15">${reason}</span>`;
  } else {
    gameResultText.innerHTML = `MATCH ENDED<br><span style="font-size:2rem; color:var(--danger)">Bạn Thua!<br><span style="font-size:1.2rem">${reason}</span></span>`;
  }
  
  gameOverOverlay.classList.remove('hidden');
  gameOverOverlay.style.opacity = '1';
  gameOverOverlay.style.transition = 'opacity 1s ease-in-out';
  
  btnSurrender.classList.add('hidden');
  btnOfferDraw.classList.add('hidden');
  btnVoteSeed.classList.add('hidden');
  document.getElementById('btnReturnLobby').classList.remove('hidden');

  setTimeout(() => {
     gameOverOverlay.style.opacity = '0';
     setTimeout(() => gameOverOverlay.classList.add('hidden'), 1000);
  }, 3000);

  socket.emit('auth', myUsername); // Refresh elo
});

document.getElementById('btnReturnLobby').addEventListener('click', () => {
    showLobby(myUsername, myCurrentElo);
});

// SURRENDER & DRAW
btnSurrender.addEventListener('click', () => {
    if(confirm('Bạn có chắc chắn muốn Đầu Hàng? (Sẽ bị tính là Thua và trừ Elo nếu đấu hạng)')) {
        socket.emit('surrender');
    }
});
btnOfferDraw.addEventListener('click', () => {
    socket.emit('offerDraw');
    btnOfferDraw.disabled = true;
    btnOfferDraw.innerText = "Đã gửi xin hòa";
});
btnVoteSeed.addEventListener('click', () => {
    socket.emit('requestChangeSeed');
    btnVoteSeed.disabled = true;
    btnVoteSeed.innerText = "Đã gửi Đổi Seed";
});

socket.on('drawRequested', () => {
    let oppName = document.getElementById('opp-name').innerText;
    createToast(`${oppName} xin hòa trận này!`, "#ffffff", 
        () => socket.emit('acceptDraw'), 
        () => socket.emit('rejectDraw')
    );
});
socket.on('seedChangeRequested', () => {
    let oppName = document.getElementById('opp-name').innerText;
    createToast(`${oppName} muốn đổi Seed khác!`, "#eab308", 
        () => socket.emit('acceptChangeSeed'), 
        () => socket.emit('rejectChangeSeed')
    );
});

socket.on('drawRejected', () => {
    btnOfferDraw.disabled = false;
    btnOfferDraw.innerText = "Xin Hòa";
    let oppName = document.getElementById('opp-name').innerText;
    alert(`${oppName} đã từ chối hòa!`);
});
socket.on('seedChangeRejected', () => {
    btnVoteSeed.disabled = false;
    btnVoteSeed.innerText = "Đổi Seed";
    let oppName = document.getElementById('opp-name').innerText;
    alert(`${oppName} không đồng ý đổi Seed!`);
});

// ================= GAMEPLAY =================
function addSysMsg(text) {
    const div = document.createElement('div');
    div.className = 'chat-msg chat-sys';
    div.innerText = `[Hệ thống] ${text}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addChatMsg(user, text) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-user">${user}:</span> ${text}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

socket.on('chat_msg', ({user, text}) => {
    addChatMsg(user, text);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (!gameScreen.classList.contains('hidden')) {
            if (document.activeElement === chatInput) {
                // Send message
                const txt = chatInput.value.trim();
                if (txt) socket.emit('chat_msg', txt);
                chatInput.value = '';
                chatInput.blur(); // Unfocus
            } else {
                chatInput.focus();
            }
        }
    }
});
