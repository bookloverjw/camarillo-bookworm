export interface Book {
  id: string;
  isbn?: string; // ISBN-13 for Bookshop.org links
  title: string;
  subtitle?: string;
  author: string;
  price: number;
  cover: string;
  category: 'Fiction' | 'Nonfiction' | 'Kids' | 'YA';
  genre: string; // BISAC Genre
  type: 'Hardcover' | 'Paperback' | 'Audiobook';
  status: 'In Stock' | 'Low Stock' | 'Preorder' | 'Preorder Closed' | 'Ships in X days';
  releaseDate?: string;
  isLimitedPreorder?: boolean;
  preorderCutoffDate?: string;
  description: string;
  isStaffPick?: boolean;
  staffReviewer?: string;
  staffQuote?: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  type: 'Author Reading' | 'Book Club' | 'Kids Story Time' | 'Workshop' | 'Signing';
  location: 'In-store' | 'Virtual';
  description: string;
  author?: string;
  featuredBookId?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  photo: string;
  bio: string;
  topPicks: string[]; // Book IDs
}

export const BOOKS: Book[] = [
  {
    id: '1',
    isbn: '9780525559474', // The Midnight Library
    title: 'The Midnight Library',
    author: 'Matt Haig',
    price: 26.00,
    cover: 'https://images.unsplash.com/photo-1538981457319-5e459479f9d0?auto=format&fit=crop&q=80&w=600',
    category: 'Fiction',
    genre: 'Literary',
    type: 'Hardcover',
    status: 'In Stock',
    description: 'Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived.',
    isStaffPick: true,
    staffReviewer: 'Elena',
    staffQuote: "A beautiful exploration of regret and the paths we don't take."
  },
  {
    id: '2',
    isbn: '9780735211292', // Atomic Habits
    title: 'Atomic Habits',
    author: 'James Clear',
    price: 28.00,
    cover: 'https://images.unsplash.com/photo-1556943418-0e5712249b9d?auto=format&fit=crop&q=80&w=600',
    category: 'Nonfiction',
    genre: 'Self-Help',
    type: 'Hardcover',
    status: 'In Stock',
    description: 'No matter your goals, Atomic Habits offers a proven framework for improving—every day.'
  },
  {
    id: '3',
    // No ISBN - fictional book
    title: 'The Lost Woods',
    author: 'S. K. Ali',
    price: 18.99,
    cover: 'https://images.unsplash.com/photo-1711185900806-bf85e7fe7767?auto=format&fit=crop&q=80&w=600',
    category: 'YA',
    genre: 'Fantasy',
    type: 'Paperback',
    status: 'Preorder',
    releaseDate: 'Feb 15, 2026',
    description: 'A captivating young adult fantasy that explores the boundaries of reality and imagination.'
  },
  {
    id: '4',
    isbn: '9780593467701', // Here We Are by Oliver Jeffers (similar)
    title: 'Little Wanderer',
    author: 'Oliver Jeffers',
    price: 17.99,
    cover: 'https://images.unsplash.com/photo-1761251946816-286632c6535e?auto=format&fit=crop&q=80&w=600',
    category: 'Kids',
    genre: 'Picture Books',
    type: 'Hardcover',
    status: 'In Stock',
    description: 'A charming story for young readers about finding your way home.'
  },
  {
    id: '5',
    isbn: '9780525657743', // Crying in H Mart
    title: 'Crying in H Mart',
    author: 'Michelle Zauner',
    price: 16.00,
    cover: 'https://images.unsplash.com/photo-1649220058039-e81e690e28ef?auto=format&fit=crop&q=80&w=600',
    category: 'Nonfiction',
    genre: 'Biography',
    type: 'Paperback',
    status: 'Low Stock',
    description: 'A powerful memoir about growing up Korean-American, losing her mother, and forging her own identity.'
  },
  {
    id: '6',
    isbn: '9781982168438', // Cloud Cuckoo Land
    title: 'Cloud Cuckoo Land',
    author: 'Anthony Doerr',
    price: 30.00,
    cover: 'https://images.unsplash.com/photo-1761384979966-546eb28f60a7?auto=format&fit=crop&q=80&w=600',
    category: 'Fiction',
    genre: 'Historical',
    type: 'Hardcover',
    status: 'In Stock',
    description: 'Set in Constantinople in the 15th century, in a small town in Idaho today, and on an interstellar ship in the future.'
  },
  {
    id: '7',
    isbn: '9780593135204', // Project Hail Mary
    title: 'Project Hail Mary',
    author: 'Andy Weir',
    price: 28.99,
    cover: 'https://images.unsplash.com/photo-1711185900806-bf85e7fe7767?auto=format&fit=crop&q=80&w=600',
    category: 'Fiction',
    genre: 'Sci-Fi',
    type: 'Hardcover',
    status: 'Ships in X days',
    description: 'Ryland Grace is the sole survivor on a desperate, last-chance mission—and if he fails, humanity and the earth itself will perish.'
  },
  {
    id: '8',
    isbn: '9780593329825', // The Paper Palace
    title: 'The Paper Palace',
    author: 'Miranda Cowley Heller',
    price: 18.00,
    cover: 'https://images.unsplash.com/photo-1538981457319-5e459479f9d0?auto=format&fit=crop&q=80&w=600',
    category: 'Fiction',
    genre: 'Contemporary',
    type: 'Paperback',
    status: 'In Stock',
    description: 'A story of love, betrayal, and a long-held family secret that unfolds over twenty-four hours.'
  },
  {
    id: '9',
    isbn: '9780593422946', // The Heaven & Earth Grocery Store
    title: 'The Heaven & Earth Grocery Store',
    author: 'James McBride',
    price: 28.00,
    cover: 'https://images.unsplash.com/photo-1761384979966-546eb28f60a7?auto=format&fit=crop&q=80&w=600',
    category: 'Fiction',
    genre: 'Historical',
    type: 'Hardcover',
    status: 'In Stock',
    description: 'A murder mystery, a story of love and community, and a glimpse into the American past.'
  },
  {
    id: '10',
    isbn: '9780385547345', // Lessons in Chemistry
    title: 'Lessons in Chemistry',
    author: 'Bonnie Garmus',
    price: 29.00,
    cover: 'https://images.unsplash.com/photo-1538981457319-5e459479f9d0?auto=format&fit=crop&q=80&w=600',
    category: 'Fiction',
    genre: 'Literary',
    type: 'Hardcover',
    status: 'In Stock',
    description: "Chemist Elizabeth Zott is not your average woman. But it's the early 1960s and her all-male team at Hastings Research Institute takes a very unscientific view of equality."
  },
  {
    id: '11',
    isbn: '9780307742483', // Killers of the Flower Moon
    title: 'Killers of the Flower Moon',
    author: 'David Grann',
    price: 17.00,
    cover: 'https://images.unsplash.com/photo-1649220058039-e81e690e28ef?auto=format&fit=crop&q=80&w=600',
    category: 'Nonfiction',
    genre: 'True Crime',
    type: 'Paperback',
    status: 'In Stock',
    description: 'The Osage Murders and the Birth of the FBI.'
  },
  {
    id: '12',
    isbn: '9780063251922', // Demon Copperhead
    title: 'Demon Copperhead',
    author: 'Barbara Kingsolver',
    price: 32.50,
    cover: 'https://images.unsplash.com/photo-1761384979966-546eb28f60a7?auto=format&fit=crop&q=80&w=600',
    category: 'Fiction',
    genre: 'Literary',
    type: 'Hardcover',
    status: 'In Stock',
    description: 'A reimagining of David Copperfield set in modern-day Appalachia.'
  },
  {
    id: '13',
    title: 'Watchmen',
    author: 'Alan Moore',
    price: 24.99,
    cover: 'https://images.unsplash.com/photo-1588421357574-87938a86fa28?auto=format&fit=crop&q=80&w=600',
    category: 'Fiction',
    genre: 'Graphic Novels',
    type: 'Paperback',
    status: 'In Stock',
    description: 'A revolutionary work of graphic fiction that reimagines the superhero genre.'
  },
  {
    id: '14',
    title: 'SMILE',
    author: 'Raina Telgemeier',
    price: 12.99,
    cover: 'https://images.unsplash.com/photo-1543004218-ee141d0ef114?auto=format&fit=crop&q=80&w=600',
    category: 'Kids',
    genre: 'Graphic Novels',
    type: 'Paperback',
    status: 'In Stock',
    description: 'A charming autobiographical graphic novel about the perils of middle school and dental drama.'
  },
  {
    id: '15',
    title: 'Heartstopper: Volume 1',
    author: 'Alice Oseman',
    price: 14.99,
    cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600',
    category: 'YA',
    genre: 'Graphic Novels',
    type: 'Paperback',
    status: 'In Stock',
    description: 'Boy meets boy. Boys become friends. Boys fall in love. A sweet and charming graphic novel about life, love, and everything in between.'
  }
];

export const EVENTS: Event[] = [
  {
    id: 'e1',
    title: 'Evening with Matt Haig',
    date: '2026-02-12',
    time: '7:00 PM',
    type: 'Author Reading',
    location: 'In-store',
    description: 'Join us for an intimate evening with Matt Haig as he discusses his latest work and answers audience questions.',
    author: 'Matt Haig',
    featuredBookId: '1'
  },
  {
    id: 'e2',
    title: 'Saturday Morning Story Time',
    date: '2026-02-14',
    time: '10:30 AM',
    type: 'Kids Story Time',
    location: 'In-store',
    description: 'A fun-filled morning for the little ones! We will be reading "Little Wanderer" and doing related crafts.',
    featuredBookId: '4'
  },
  {
    id: 'e3',
    title: 'Modern Fiction Book Club',
    date: '2026-02-18',
    time: '6:30 PM',
    type: 'Book Club',
    location: 'Virtual',
    description: 'This month we are discussing "Cloud Cuckoo Land" by Anthony Doerr. Registration required for Zoom link.',
    featuredBookId: '6'
  },
  {
    id: 'e4',
    title: 'Writing Memoir Workshop',
    date: '2026-02-22',
    time: '2:00 PM',
    type: 'Workshop',
    location: 'In-store',
    description: 'Learn the basics of personal storytelling and memoir writing in this hands-on workshop led by local authors.'
  }
];

export const STAFF: StaffMember[] = [
  {
    id: 's1',
    name: 'Elena Vance',
    role: 'Store Manager',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=400',
    bio: 'Elena has been with Camarillo Bookworm for over 15 years. She loves speculative fiction and anything that makes her question reality.',
    topPicks: ['1', '6', '12']
  },
  {
    id: 's2',
    name: 'Marcus Thorne',
    role: 'Lead Bookseller',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
    bio: 'Marcus is our resident history and non-fiction expert. If you need a biography or a deep dive into world history, he is your guy.',
    topPicks: ['2', '5', '11']
  }
];

export const MERCH = [
  { id: 'm1', name: 'Signature Tote Bag', price: 15.00, image: 'https://images.unsplash.com/photo-1758789645790-f69cce68a32b?auto=format&fit=crop&q=80&w=600' },
  { id: 'm2', name: 'Literary Mug', price: 12.00, image: 'https://images.unsplash.com/photo-1517142089942-ba376ce32a2e?auto=format&fit=crop&q=80&w=600' },
  { id: 'm3', name: 'Bookworm Enamel Pin', price: 8.00, image: 'https://images.unsplash.com/photo-1590247813693-5541d1c609fd?auto=format&fit=crop&q=80&w=600' },
  { id: 'm4', name: 'Scented Candle: Old Book Smell', price: 22.00, image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=600' }
];
