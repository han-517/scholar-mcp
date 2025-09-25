export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract?: string;
  published?: string;
  updated?: string;
  categories?: string[];
  doi?: string;
  journal?: string;
  booktitle?: string;
  year?: number;
  pdfUrl?: string;
  source: 'arxiv' | 'dblp';
}

export interface SearchOptions {
  query: string;
  maxResults?: number;
  startDate?: string;
  endDate?: string;
  author?: string;
  category?: string;
}

export interface SearchResult {
  papers: Paper[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
}