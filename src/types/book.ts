export interface Book {
  id: string;
  title: string;
  author: string;
  year?: string;
  color: string; // Hex color for clothbound cover (Navy, Burgundy, Forest Green, Amber, Charcoal, etc.)
  foilColor: string; // 'gold' | 'silver' | 'copper' | 'deboss'
  height: number; // e.g. 3.2 to 4.2
  width: number;  // e.g. 2.2 to 2.8
  depth: number;  // thickness e.g. 0.4 to 0.9
  spineText?: string;
  frontCoverUrl?: string;
  backCoverUrl?: string;
  spineCoverUrl?: string;
  pages?: BookPage[];
}

export interface BookPage {
  pageNumber: number;
  text: string;
  formattedHtml?: string;
  fontSize?: number;
  textColor?: string;
  bgColor?: string;
  fontFamily?: string;
}
