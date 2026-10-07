export const factionOrder = ['火', '水', '土', '雷'];

export function groupCardsByFaction(cards = []) {
  const groups = new Map();

  for (const card of cards) {
    const attribute = card?.attribute ?? '無';
    if (!groups.has(attribute)) {
      groups.set(attribute, []);
    }
    groups.get(attribute).push(card);
  }

  const ordered = factionOrder
    .filter((attribute) => groups.has(attribute))
    .map((attribute) => ({ name: attribute, cards: groups.get(attribute) }));

  const additional = [...groups.entries()]
    .filter(([attribute]) => !factionOrder.includes(attribute))
    .map(([attribute, groupedCards]) => ({ name: attribute, cards: groupedCards }));

  return [...ordered, ...additional];
}
