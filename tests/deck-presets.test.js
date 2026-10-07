import test from 'node:test';
import assert from 'node:assert/strict';
import { deckPresets, getDeckById } from '../public/deckPresets.js';

test('deck presets exist and each selected deck has 30 cards', () => {
  assert.ok(deckPresets.length >= 4);
  for (const deck of deckPresets) {
    assert.equal(deck.cards.length, 30, `${deck.name} is not 30 cards`);
  }

  const selectedDeck = getDeckById('blaze-ritual');
  assert.equal(selectedDeck.name, '火の儀式');
  assert.equal(selectedDeck.cards.length, 30);
});
