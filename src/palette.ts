/** Every colour the scene can use. Brightness is applied per cell via alpha. */
export const PALETTE = [
  '#f2f7ff', // 0 snow
  '#a9bdd4', // 1 snow (dim, bluish)
  '#1d7236', // 2 pine — deep
  '#2ea24a', // 3 pine
  '#52d062', // 4 pine — lit
  '#b2f792', // 5 pine — highlight
  '#ffcf4a', // 6 gold
  '#ffecad', // 7 pale gold
  '#ff4d4f', // 8 red
  '#d9263f', // 9 deep red
  '#62b4ff', // 10 ice blue
  '#a8673d', // 11 bark
  '#fff6e0', // 12 warm white
  '#ff8fbd', // 13 rose
  '#ecdcb8', // 14 champagne
  '#d8e1ee', // 15 silver
] as const;

export const C = {
  snow: 0,
  snowDim: 1,
  pine0: 2,
  pine1: 3,
  pine2: 4,
  pine3: 5,
  gold: 6,
  goldPale: 7,
  red: 8,
  deepRed: 9,
  blue: 10,
  bark: 11,
  warm: 12,
  rose: 13,
  champagne: 14,
  silver: 15,
} as const;
