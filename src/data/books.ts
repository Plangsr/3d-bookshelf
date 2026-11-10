import { Book } from '@/types/book';

// Mock book collection: 1 showcase book for initial presentation
export const INITIAL_BOOKS: Book[] = [
  {
    id: 'book-project-5',
    title: 'The Eye of Providence',
    author: 'Hermes Trismegistus',
    year: '1924',
    color: '#1e293b', // Deep Editorial Navy
    foilColor: 'gold', // Elegant Gold Foil
    height: 3.9,
    width: 2.5,
    depth: 0.72,
    spineText: 'THE EYE OF PROVIDENCE',
    pages: [
      {
        pageNumber: 1,
        text: 'บทที่ ๑: พันธนาการแห่งกาลเวลา\n\nในห้วงมิติที่เงียบสงัด คลื่นจักรพรรดิไร้พ่ายได้ตื่นขึ้น เนตรแห่งโชคชะตาคอยเฝ้ามองสรรพสิ่งบนชั้นหนังสือไม้วอลนัตโบราณ ทุกหน้ากระดาษที่ถูกเปิดคือการคลี่คลายปริศนาที่ซ่อนเร้น',
        fontSize: 18,
        textColor: '#1c1917',
        bgColor: '#faf7f2',
      },
      {
        pageNumber: 2,
        text: 'ความรู้ที่แท้จริงไม่ได้อยู่ในความหนาของเล่ม แต่อยู่ในร่องรอยของแสงที่สะท้อนลงบนฟอยล์สีทองและเส้นใยผ้าหุ้มปกที่ผ่านกาลเวลามานับร้อยปี',
        fontSize: 18,
        textColor: '#1c1917',
        bgColor: '#faf7f2',
      }
    ]
  }
];
