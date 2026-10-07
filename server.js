import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 3000;
const rooms = new Map();
const cardLibrary = [
  { id: 'ember-fox', name: '火花の狐', kind: 'monster', cost: 1, attack: 2, health: 1, icon: '🦊', color: 'ember', attribute: '炎', copies: 4, ability: { id: 'haste', name: '速攻', text: '召喚したターンに攻撃できる。' }, text: '素早く駆ける小さな炎。' },
  { id: 'moss-guardian', name: '苔むす守護者', kind: 'monster', cost: 2, attack: 1, health: 4, icon: '🪨', color: 'moss', attribute: '森', copies: 4, ability: { id: 'guard', name: '守護', text: '守護がいる間、相手は他を攻撃できない。' }, text: '静かな森の盾となる。' },
  { id: 'moon-archer', name: '月影の射手', kind: 'monster', cost: 2, attack: 3, health: 2, icon: '🏹', color: 'moon', attribute: '月', copies: 4, text: '月光をまとい、敵を射抜く。' },
  { id: 'rune-witch', name: 'ルーンの魔女', kind: 'monster', cost: 3, attack: 2, health: 4, icon: '🧙', color: 'violet', attribute: '秘', copies: 4, text: '古き文字に魔力を宿す。' },
  { id: 'iron-stag', name: '鉄角の大鹿', kind: 'monster', cost: 4, attack: 4, health: 5, icon: '🦌', color: 'gold', attribute: '森', copies: 4, ability: { id: 'guard', name: '守護', text: '守護がいる間、相手は他を攻撃できない。' }, text: '森の王が大地を踏み鳴らす。' },
  { id: 'star-dragon', name: '星喰らいの竜', kind: 'monster', cost: 5, attack: 6, health: 6, icon: '🐉', color: 'ember', attribute: '星', copies: 4, text: '夜空の星を喰らう古竜。' },
  { id: 'healing-spring', name: '癒やしの泉', kind: 'spell', cost: 2, icon: '💧', color: 'moon', attribute: '水', copies: 3, ability: { id: 'heal', name: '回復', text: 'あなたの英雄の体力を3回復する。' }, text: 'あなたの英雄の体力を3回復。' },
  { id: 'meteor', name: '流星の一撃', kind: 'spell', cost: 3, icon: '☄️', color: 'ember', attribute: '炎', copies: 3, ability: { id: 'damage', name: '直撃', text: '敵の英雄に3ダメージを与える。' }, text: '敵の英雄に3ダメージ。' },
];

function createDeck() {
  const cards = cardLibrary.flatMap((card) => Array.from({ length: card.copies }, () => ({ ...card, instanceId: randomUUID() })));
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }
  return cards;
}

function createPlayer(id, name) {
  const deck = createDeck();
  return { id, name: name.slice(0, 18) || '旅人', health: 20, mana: 0, maxMana: 0, hand: deck.splice(0, 4), deck, board: [] };
}

function publicCard(card) {
  const { instanceId, id, name, kind, cost, attack, health, icon, color, attribute, ability, text } = card;
  return { instanceId, id, name, kind, cost, attack, health, icon, color, attribute, ability, text };
}

function snapshot(room, recipientId) {
  return {
    type: 'state',
    roomId: room.id,
    status: room.status,
    turn: room.turn,
    activePlayerId: room.players[room.turn]?.id,
    you: recipientId,
    winner: room.winner ?? null,
    message: room.message,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      health: player.health,
      mana: player.mana,
      maxMana: player.maxMana,
      deckCount: player.deck.length,
      hand: player.id === recipientId ? player.hand.map(publicCard) : undefined,
      handCount: player.hand.length,
      board: player.board.map((card) => ({ ...publicCard(card), currentHealth: card.currentHealth, canAttack: card.canAttack })),
    })),
  };
}

function broadcast(room) {
  for (const player of room.players) {
    const socket = room.connections.get(player.id);
    if (socket?.readyState === 1) socket.send(JSON.stringify(snapshot(room, player.id)));
  }
}

function announce(room, message) {
  room.message = message;
  broadcast(room);
}

function startGame(room) {
  room.status = 'playing';
  room.turn = 0;
  const first = room.players[0];
  first.maxMana = 1;
  first.mana = 1;
  room.message = `${first.name}のターンです`;
}

function endTurn(room, player) {
  if (room.players[room.turn].id !== player.id) return;
  room.turn = (room.turn + 1) % room.players.length;
  const next = room.players[room.turn];
  next.maxMana = Math.min(10, next.maxMana + 1);
  next.mana = next.maxMana;
  if (next.deck.length) next.hand.push(next.deck.shift());
  next.board.forEach((card) => { card.canAttack = true; });
  room.message = `${next.name}のターンです`;
  broadcast(room);
}

function handleAction(room, player, action) {
  if (room.status !== 'playing' || room.players[room.turn]?.id !== player.id) return;
  if (action.type === 'play') {
    const cardIndex = player.hand.findIndex((card) => card.instanceId === action.cardId);
    const card = player.hand[cardIndex];
    if (!card || card.cost > player.mana) return;
    player.mana -= card.cost;
    player.hand.splice(cardIndex, 1);
    if (card.kind === 'monster') {
      if (player.board.length >= 5) {
        player.hand.splice(cardIndex, 0, card);
        player.mana += card.cost;
        return;
      }
      player.board.push({ ...card, currentHealth: card.health, canAttack: card.ability?.id === 'haste' });
      announce(room, `${player.name}は「${card.name}」を召喚した`);
    } else {
      if (card.ability?.id === 'heal') player.health = Math.min(20, player.health + 3);
      if (card.ability?.id === 'damage') {
        const enemy = room.players.find((entry) => entry.id !== player.id);
        enemy.health -= 3;
      }
      room.message = `${player.name}は「${card.name}」を唱えた`;
      checkWinner(room);
      broadcast(room);
    }
  } else if (action.type === 'attack') {
    const attacker = player.board.find((card) => card.instanceId === action.cardId);
    const enemy = room.players.find((entry) => entry.id !== player.id);
    if (!attacker?.canAttack) return;
    const guards = enemy.board.filter((card) => card.ability?.id === 'guard');
    if (action.targetId === 'hero') {
      if (guards.length) return;
      attacker.canAttack = false;
      enemy.health -= attacker.attack;
      room.message = `${attacker.name}が${enemy.name}を攻撃 (${attacker.attack}ダメージ)`;
    } else {
      const target = enemy.board.find((card) => card.instanceId === action.targetId);
      if (!target) return;
      if (guards.length && target.ability?.id !== 'guard') return;
      attacker.canAttack = false;
      target.currentHealth -= attacker.attack;
      attacker.currentHealth -= target.attack;
      enemy.board = enemy.board.filter((card) => card.currentHealth > 0);
      player.board = player.board.filter((card) => card.currentHealth > 0);
      room.message = `${attacker.name}と${target.name}が激突した`;
    }
    checkWinner(room);
    broadcast(room);
  } else if (action.type === 'endTurn') {
    endTurn(room, player);
  }
}

function checkWinner(room) {
  const defeated = room.players.find((player) => player.health <= 0);
  if (defeated) {
    room.status = 'finished';
    room.winner = room.players.find((player) => player.id !== defeated.id).id;
    room.message = `${room.players.find((player) => player.id === room.winner).name}の勝利！`;
  }
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const relativePath = pathname === '/' ? 'index.html' : normalize(decodeURIComponent(pathname)).replace(/^([/\\]|\.\.(?:[/\\]|$))+/, '');
  try {
    const content = await readFile(join(root, 'public', relativePath));
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
    response.writeHead(200, { 'Content-Type': types[extname(relativePath)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

const webSockets = new WebSocketServer({ server });
webSockets.on('connection', (socket) => {
  let room;
  let player;
  socket.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }
    if (data.type === 'join') {
      const requestedId = String(data.roomId || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      if (requestedId) {
        room = rooms.get(requestedId);
        if (!room || room.status !== 'waiting' || room.players.length >= 2) {
          socket.send(JSON.stringify({ type: 'error', message: 'そのルームには参加できません。IDを確認してください。' }));
          return;
        }
      } else {
        let roomId;
        do { roomId = Math.random().toString(36).slice(2, 8).toUpperCase(); } while (rooms.has(roomId));
        room = { id: roomId, status: 'waiting', turn: 0, winner: null, message: '対戦相手を待っています…', players: [], connections: new Map() };
        rooms.set(roomId, room);
      }
      player = createPlayer(randomUUID(), String(data.name || '旅人'));
      room.players.push(player);
      room.connections.set(player.id, socket);
      socket.send(JSON.stringify({ type: 'joined', playerId: player.id, roomId: room.id }));
      if (room.players.length === 2) startGame(room);
      broadcast(room);
      return;
    }
    if (room && player && data.type) handleAction(room, player, data);
  });
  socket.on('close', () => {
    if (!room || !player) return;
    room.connections.delete(player.id);
    if (room.status === 'waiting') {
      room.players = room.players.filter((entry) => entry.id !== player.id);
      rooms.delete(room.id);
      return;
    }
    if (room.status === 'playing') {
      room.status = 'finished';
      room.winner = room.players.find((entry) => entry.id !== player.id)?.id;
      room.message = `${player.name}が対戦を離れました`;
      broadcast(room);
    }
  });
});

server.listen(port, '0.0.0.0', () => console.log(`Battle Base is running at http://localhost:${port}`));