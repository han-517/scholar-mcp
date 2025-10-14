export type PaperSource = 'arxiv' | 'venue';

export interface SearchOptions {
  source: PaperSource;
  query: string;
  show?: number;
  skip?: number;
  sort?: number;
}

export interface PaperSummary {
  id: string;
  source: PaperSource;
  rank: number;
  title: string;
  detailUrl: string;
  externalUrl: string;
  pdfUrl?: string;
  pdfStars?: number;
  kimiStars?: number;
  authors: string[];
  abstract: string;
  subjects: string[];
  publishTime?: string;
  relatedKeywords: string[];
}

export interface SearchResult {
  source: PaperSource;
  query: string;
  total: number;
  papers: PaperSummary[];
}

export interface DownloadOptions {
  source: PaperSource;
  paperId: string;
  downloadFolder: string;
  filename?: string;
}

export interface DownloadResult {
  pdfUrl: string;
  filePath: string;
  fileSize: number;
}

export interface KimiQA {
  question: string;
  answer: string;
}
