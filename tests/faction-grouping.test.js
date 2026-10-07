import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCardsByFaction } from '../public/cardGrouping.js';

test('cards are grouped by faction in a stable order', () => {
  const cards = [
    { id: 'b', attribute: '土' },
    { id: 'a', attribute: '火' },
    { id: 'c', attribute: '火' },
    { id: 'd', attribute: '水' },
  ];

  const grouped = groupCardsByFaction(cards);

  assert.deepEqual(
    grouped.map((group) => group.name),
    ['火', '水', '土'],
  );
  assert.deepEqual(
    grouped.map((group) => group.cards.map((card) => card.id)),
    [['a', 'c'], ['d'], ['b']],
  );
});
