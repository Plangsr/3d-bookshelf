import { Book } from '@/types/book';

// A cohesive 19-piece library of varied clothbound hardcovers with distinct proportions and foil motifs
export const INITIAL_BOOKS: Book[] = [
  {
    id: 'book-1',
    title: 'The Architecture of Solitude',
    author: 'Elena Vance',
    year: '1924',
    color: '#1e293b', // Deep Slate
    foilColor: 'gold',
    height: 3.8,
    width: 2.5,
    depth: 0.65,
    spineText: 'THE ARCHITECTURE OF SOLITUDE',
    pages: [
      {
        pageNumber: 1,
        text: 'Chapter I: The Silent Rooms\n\nThere is a peculiar stillness that inhabits structures left to the mercy of passing hours. In the quiet chambers of winter, stones retain memories that human recollection has long surrendered.',
        fontSize: 18,
        textColor: '#1c1917',
        bgColor: '#faf7f2',
      },
      {
        pageNumber: 2,
        text: 'The cedar beams overhead still carried the resinous scent of autumn rain. One could trace the path of morning light as it measured out the dimensions of the hall.',
        fontSize: 18,
        textColor: '#1c1917',
        bgColor: '#faf7f2',
      }
    ]
  },
  {
    id: 'book-2',
    title: 'Botanica Obscura',
    author: 'Julian Thorne',
    year: '1888',
    color: '#1b3b2b', // Deep Forest Green
    foilColor: 'gold',
    height: 4.1,
    width: 2.7,
    depth: 0.85,
    spineText: 'BOTANICA OBSCURA — THORNE',
    pages: [
      {
        pageNumber: 1,
        text: 'Index of Nocturnal Flora\n\nObserved under full moon in the high valleys of the Pyrenees. Specimens collected between 1882 and 1887. The luminescence appears inversely proportional to ambient humidity.',
        fontSize: 18,
        textColor: '#1c1917',
        bgColor: '#fdfbf7',
      }
    ]
  },
  {
    id: 'book-3',
    title: 'Chronicles of the Tides',
    author: 'M. O. Sterling',
    year: '1902',
    color: '#16384c', // Ocean Deep Blue
    foilColor: 'silver',
    height: 3.5,
    width: 2.4,
    depth: 0.55,
    spineText: 'CHRONICLES OF THE TIDES',
    pages: [
      {
        pageNumber: 1,
        text: 'Part I: The Western Shoals\n\nTo know the ocean is to know cyclical disappearance. The shoreline does not end; it merely surrenders and reclaims with the breathing rhythm of celestial gravity.',
        fontSize: 18,
        textColor: '#1c1917',
        bgColor: '#faf7f2',
      }
    ]
  },
  {
    id: 'book-4',
    title: 'The Crimson Monograph',
    author: 'Arthur Pendelton',
    year: '1911',
    color: '#4c171e', // Rich Burgundy / Wine
    foilColor: 'gold',
    height: 3.9,
    width: 2.6,
    depth: 0.7,
    spineText: 'THE CRIMSON MONOGRAPH',
  },
  {
    id: 'book-5',
    title: 'Geometry of Echoes',
    author: 'S. K. Althaus',
    year: '1937',
    color: '#382e25', // Warm Umber / Walnut
    foilColor: 'copper',
    height: 3.4,
    width: 2.3,
    depth: 0.5,
    spineText: 'GEOMETRY OF ECHOES — ALTHAUS',
  },
  {
    id: 'book-6',
    title: 'Nocturne in Ochre',
    author: 'Clara Dubois',
    year: '1942',
    color: '#5c3a21', // Ochre Terracotta
    foilColor: 'gold',
    height: 4.2,
    width: 2.8,
    depth: 0.9,
    spineText: 'NOCTURNE IN OCHRE',
  },
  {
    id: 'book-7',
    title: 'Principles of Celestial Navigation',
    author: 'Capt. Tobias Ward',
    year: '1875',
    color: '#0f2922', // Cypress Dark Green
    foilColor: 'gold',
    height: 4.3,
    width: 2.9,
    depth: 0.95,
    spineText: 'CELESTIAL NAVIGATION',
  },
  {
    id: 'book-8',
    title: 'Labyrinth of Whispers',
    author: 'Beatriz Lira',
    year: '1954',
    color: '#2e1c36', // Deep Plum Velvet
    foilColor: 'silver',
    height: 3.6,
    width: 2.4,
    depth: 0.6,
    spineText: 'LABYRINTH OF WHISPERS',
  },
  {
    id: 'book-9',
    title: 'Treatise on Forgotten Bells',
    author: 'Father Dominic Roy',
    year: '1894',
    color: '#292b2f', // Cast Iron Dark Grey
    foilColor: 'copper',
    height: 3.7,
    width: 2.5,
    depth: 0.75,
    spineText: 'FORGOTTEN BELLS',
  },
  {
    id: 'book-10',
    title: 'The Indigo Horizon',
    author: 'Karin Lindqvist',
    year: '1961',
    color: '#192b45', // Midnight Indigo
    foilColor: 'silver',
    height: 3.9,
    width: 2.6,
    depth: 0.65,
    spineText: 'THE INDIGO HORIZON',
  },
  {
    id: 'book-11',
    title: 'Anatomy of the Winter Orchard',
    author: 'Henrik Vane',
    year: '1918',
    color: '#42372c', // Dried Bark
    foilColor: 'gold',
    height: 3.5,
    width: 2.35,
    depth: 0.52,
    spineText: 'WINTER ORCHARD — VANE',
  },
  {
    id: 'book-12',
    title: 'Theory of Shadows & Prisms',
    author: 'Lucian Frost',
    year: '1907',
    color: '#1a1f2c', // Cobalt Shadow
    foilColor: 'silver',
    height: 4.0,
    width: 2.65,
    depth: 0.8,
    spineText: 'SHADOWS & PRISMS',
  },
  {
    id: 'book-13',
    title: 'The Golden Ratio in Flora',
    author: 'A. E. Moreau',
    year: '1929',
    color: '#4f3b18', // Burnished Gold Leaf Tone
    foilColor: 'gold',
    height: 3.65,
    width: 2.5,
    depth: 0.58,
    spineText: 'GOLDEN RATIO — MOREAU',
  },
  {
    id: 'book-14',
    title: 'Atlas of Subterranean Rivers',
    author: 'Dr. Gregory Finch',
    year: '1885',
    color: '#1d2f33', // Deep Teal Basin
    foilColor: 'copper',
    height: 4.25,
    width: 2.85,
    depth: 0.92,
    spineText: 'SUBTERRANEAN RIVERS',
  },
  {
    id: 'book-15',
    title: 'The Amber Lantern',
    author: 'Rowena March',
    year: '1933',
    color: '#52291b', // Amber Russet
    foilColor: 'gold',
    height: 3.45,
    width: 2.4,
    depth: 0.48,
    spineText: 'THE AMBER LANTERN',
  },
  {
    id: 'book-16',
    title: 'Chronography of Mountain Passes',
    author: 'Walter Sterling',
    year: '1905',
    color: '#283533', // Alpine Pine
    foilColor: 'silver',
    height: 3.85,
    width: 2.55,
    depth: 0.72,
    spineText: 'MOUNTAIN PASSES — STERLING',
  },
  {
    id: 'book-17',
    title: 'Essays on Silence & Form',
    author: 'Yoko Moriyama',
    year: '1968',
    color: '#222225', // Charcoal Black Cloth
    foilColor: 'silver',
    height: 3.3,
    width: 2.3,
    depth: 0.45,
    spineText: 'SILENCE & FORM',
  },
  {
    id: 'book-18',
    title: 'The Silver Thread of Memory',
    author: 'Isolde Blanche',
    year: '1915',
    color: '#332938', // Dusty Damson
    foilColor: 'silver',
    height: 3.75,
    width: 2.5,
    depth: 0.68,
    spineText: 'THE SILVER THREAD',
  },
  {
    id: 'book-19',
    title: 'Compendium of Lost Cartography',
    author: 'Professor V. H. Cross',
    year: '1899',
    color: '#3d251d', // Rich Mahogany
    foilColor: 'gold',
    height: 4.4,
    width: 2.95,
    depth: 1.05,
    spineText: 'LOST CARTOGRAPHY — CROSS',
  }
];
