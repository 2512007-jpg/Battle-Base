const repeat = (id, times) => Array.from({ length: times }, () => id);

export const deckPresets = [
  {
    id: 'blaze-ritual',
    name: '火の儀式',
    cards: [
      ...repeat('flame-scout', 6),
      ...repeat('magma-guard', 4),
      ...repeat('flare-burst', 3),
      ...repeat('spark-hawk', 4),
      ...repeat('deep-heal', 3),
      ...repeat('stone-giant', 3),
      ...repeat('storm-call', 3),
      ...repeat('tide-sage', 4),
    ],
  },
  {
    id: 'tide-ward',
    name: '水の守護',
    cards: [
      ...repeat('tide-sage', 5),
      ...repeat('deep-heal', 4),
      ...repeat('ripple-warden', 5),
      ...repeat('stone-giant', 4),
      ...repeat('spark-hawk', 3),
      ...repeat('flare-burst', 3),
      ...repeat('storm-call', 3),
      ...repeat('earth-bind', 3),
    ],
  },
  {
    id: 'earth-hold',
    name: '土の鎮座',
    cards: [
      ...repeat('stone-giant', 6),
      ...repeat('root-warden', 5),
      ...repeat('earth-bind', 4),
      ...repeat('magma-guard', 3),
      ...repeat('ripple-warden', 4),
      ...repeat('deep-heal', 3),
      ...repeat('storm-call', 3),
      ...repeat('spark-hawk', 2),
    ],
  },
  {
    id: 'storm-surge',
    name: '雷の奔流',
    cards: [
      ...repeat('spark-hawk', 6),
      ...repeat('thunder-witch', 5),
      ...repeat('storm-call', 4),
      ...repeat('flare-burst', 3),
      ...repeat('tide-sage', 4),
      ...repeat('root-warden', 3),
      ...repeat('deep-heal', 3),
      ...repeat('stone-giant', 2),
    ],
  },
];

export function getDeckById(deckId) {
  return deckPresets.find((deck) => deck.id === deckId) ?? deckPresets[0];
}
