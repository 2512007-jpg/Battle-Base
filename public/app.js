const elements = Object.fromEntries([
  'connection', 'lobby', 'waiting', 'game', 'player-name', 'create-room', 'room-code', 'join-room', 'lobby-error', 'waiting-code', 'copy-code', 'copy-hint', 'cancel-room', 'game-room', 'turn-label', 'leave-game', 'opponent-name', 'opponent-health', 'opponent-mana', 'opponent-deck', 'opponent-hand', 'opponent-board', 'battle-message', 'player-name-display', 'player-health', 'player-mana', 'player-deck', 'player-board', 'player-hand', 'hand-count', 'hand-hint', 'end-turn', 'game-result', 'result-kicker', 'result-title', 'play-again',
].map((id) => [id, document.getElementById(id)]));

let socket;
let playerId;
let roomId;
let state;
let selectedAttacker;
let playerName = '';

function setConnection(connected, text) {
  elements.connection.classList.toggle('offline', !connected);
  elements.connection.innerHTML = `<span></span> ${text}`;
}

function showView(name) {
  for (const view of ['lobby', 'waiting', 'game']) elements[view].classList.toggle('hidden', view !== name);
}

function connect(joinRoomId) {
  playerName = elements['player-name'].value.trim() || '旅人';
  elements['lobby-error'].textContent = '';
  elements['create-room'].disabled = true;
  elements['join-room'].disabled = true;
  setConnection(false, '接続中…');
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'join', roomId: joinRoomId, name: playerName })));
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'error') {
      elements['lobby-error'].textContent = message.message;
      elements['create-room'].disabled = false;
      elements['join-room'].disabled = false;
      setConnection(true, '接続済み');
      socket.close();
      return;
    }
    if (message.type === 'joined') {
      playerId = message.playerId;
      roomId = message.roomId;
      elements['waiting-code'].textContent = roomId;
      elements['game-room'].textContent = `ROOM ${roomId}`;
    }
    if (message.type === 'state') {
      state = message;
      render();
    }
  });
  socket.addEventListener('close', () => {
    setConnection(false, '未接続');
    elements['create-room'].disabled = false;
    elements['join-room'].disabled = false;
  });
  socket.addEventListener('error', () => {
    elements['lobby-error'].textContent = 'サーバーに接続できませんでした。時間をおいて再度お試しください。';
  });
}

function send(type, values = {}) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, ...values }));
}

function renderBoard(container, cards, isEnemy) {
  container.innerHTML = cards.map((card) => {
    const selected = card.instanceId === selectedAttacker;
    const canAttack = card.canAttack;
    return `<button class="minion ${selected ? 'selected' : ''} ${!canAttack && !isEnemy ? 'cannot-act' : ''}" data-card-id="${card.instanceId}" data-enemy="${isEnemy}" title="${isEnemy ? '攻撃対象にする' : canAttack ? '攻撃する' : 'このターンは攻撃済み'}"><span class="card-icon">${card.icon}</span><span class="card-name">${card.name}</span><span class="stat-row"><b class="stat">${card.attack}</b><b class="stat health">${card.currentHealth}</b></span></button>`;
  }).join('');
}

function render() {
  const you = state.players.find((player) => player.id === playerId);
  const enemy = state.players.find((player) => player.id !== playerId);
  if (!you) return;
  setConnection(true, '対戦サーバー接続中');
  if (state.status === 'waiting') {
    showView('waiting');
    elements['waiting-code'].textContent = state.roomId;
    return;
  }
  showView('game');
  elements['game-room'].textContent = `ROOM ${state.roomId}`;
  elements['opponent-name'].textContent = enemy?.name || '対戦相手';
  elements['player-name-display'].textContent = you.name;
  elements['opponent-health'].textContent = enemy?.health ?? 20;
  elements['player-health'].textContent = you.health;
  elements['opponent-mana'].textContent = `${enemy?.mana ?? 0} / ${enemy?.maxMana ?? 0}`;
  elements['player-mana'].textContent = `${you.mana} / ${you.maxMana}`;
  elements['opponent-deck'].textContent = enemy?.deckCount ?? 0;
  elements['player-deck'].textContent = you.deckCount;
  elements['battle-message'].textContent = state.message || '森が静かに見守っている';
  const isMyTurn = state.activePlayerId === playerId && state.status === 'playing';
  elements['turn-label'].textContent = isMyTurn ? 'あなたのターン' : state.status === 'finished' ? '対戦終了' : '相手のターン';
  elements['turn-label'].style.color = isMyTurn ? '#d8b96b' : '#a6b3a5';
  elements['end-turn'].disabled = !isMyTurn;
  elements['player-hand'].innerHTML = you.hand.map((card) => `<button class="hand-card ${card.kind === 'spell' ? 'spell' : ''} ${card.cost > you.mana ? 'unaffordable' : ''}" data-card-id="${card.instanceId}" title="${card.text}"><span class="card-cost">${card.cost}</span><span class="card-icon">${card.icon}</span><span class="card-name">${card.name}</span>${card.kind === 'unit' ? `<span class="card-stats">${card.attack} ⚔ &nbsp; ${card.health} ♥</span>` : '<span class="card-stats">SPELL</span>'}<span class="card-text">${card.text}</span></button>`).join('');
  elements['hand-count'].textContent = you.hand.length;
  elements['hand-hint'].textContent = isMyTurn ? 'カードを選んでプレイ' : '相手の手番です';
  elements['opponent-hand'].innerHTML = Array.from({ length: enemy?.handCount ?? 0 }, () => '<span class="back-card"></span>').join('');
  renderBoard(elements['player-board'], you.board, false);
  renderBoard(elements['opponent-board'], enemy?.board ?? [], true);
  if (state.status === 'finished') {
    elements['game-result'].classList.remove('hidden');
    const didWin = state.winner === playerId;
    elements['result-title'].textContent = didWin ? '勝利' : '敗北';
    elements['result-kicker'].textContent = didWin ? 'THE GROVE REMEMBERS' : 'THE GROVE GOES QUIET';
  } else {
    elements['game-result'].classList.add('hidden');
  }
}

elements['create-room'].addEventListener('click', () => connect(''));
elements['join-room'].addEventListener('click', () => {
  const code = elements['room-code'].value.trim().toUpperCase();
  if (!code) {
    elements['lobby-error'].textContent = 'ルームコードを入力してください。';
    return;
  }
  connect(code);
});
elements['room-code'].addEventListener('input', () => { elements['room-code'].value = elements['room-code'].value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
elements['room-code'].addEventListener('keydown', (event) => { if (event.key === 'Enter') elements['join-room'].click(); });
elements['copy-code'].addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(roomId);
    elements['copy-hint'].textContent = 'コピーしました';
  } catch {
    elements['copy-hint'].textContent = `ルームコード: ${roomId}`;
  }
});
elements['cancel-room'].addEventListener('click', () => { socket?.close(); state = null; showView('lobby'); });
elements['leave-game'].addEventListener('click', () => { socket?.close(); state = null; selectedAttacker = null; showView('lobby'); });
elements['play-again'].addEventListener('click', () => { socket?.close(); state = null; selectedAttacker = null; showView('lobby'); });
elements['end-turn'].addEventListener('click', () => send('endTurn'));
elements['player-hand'].addEventListener('click', (event) => {
  const card = event.target.closest('[data-card-id]');
  if (card) send('play', { cardId: card.dataset.cardId });
});
elements['player-board'].addEventListener('click', (event) => {
  const card = event.target.closest('[data-card-id]');
  if (!card || state?.activePlayerId !== playerId) return;
  const unit = state.players.find((player) => player.id === playerId)?.board.find((entry) => entry.instanceId === card.dataset.cardId);
  if (unit?.canAttack) selectedAttacker = selectedAttacker === unit.instanceId ? null : unit.instanceId;
  render();
});
elements['opponent-board'].addEventListener('click', (event) => {
  const target = event.target.closest('[data-card-id]');
  if (target && selectedAttacker) {
    send('attack', { cardId: selectedAttacker, targetId: target.dataset.cardId });
    selectedAttacker = null;
  }
});
elements['enemy-hero-target'].addEventListener('click', () => {
  if (!selectedAttacker) return;
  send('attack', { cardId: selectedAttacker, targetId: 'hero' });
  selectedAttacker = null;
});

showView('lobby');
setConnection(false, '未接続');