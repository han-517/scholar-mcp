import fs from 'fs';
import path from 'path';
import {
  downloadPaper,
  fetchPaperDetail,
  getKimiAnalysis,
  searchPapers,
} from '../src/cool-papers.js';
import { PaperSummary, SearchResult } from '../src/types.js';

type PublicPaperSummary = Omit<
  PaperSummary,
  'detailUrl' | 'pdfStars' | 'kimiStars'
>;

interface PublicSearchResult
  extends Omit<SearchResult, 'papers'> {
  papers: PublicPaperSummary[];
}

function sanitizePaper(paper: PaperSummary): PublicPaperSummary {
  const { detailUrl: _detail, pdfStars: _pdf, kimiStars: _kimi, ...rest } =
    paper;
  return rest;
}

function logSection(title: string, payload: unknown) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(payload, null, 2));
}

async function runSearches() {
  const arxivRaw = await searchPapers({
    source: 'arxiv',
    query: 'swe',
    show: 2,
    sort: 0,
  });

  const venueRaw = await searchPapers({
    source: 'venue',
    query: 'swe',
    show: 2,
    sort: 1,
  });

  const arxiv: PublicSearchResult = {
    source: arxivRaw.source,
    query: arxivRaw.query,
    total: arxivRaw.total,
    papers: arxivRaw.papers.map(sanitizePaper),
  };

  const venue: PublicSearchResult = {
    source: venueRaw.source,
    query: venueRaw.query,
    total: venueRaw.total,
    papers: venueRaw.papers.map(sanitizePaper),
  };

  logSection('Search - arXiv', arxiv);
  logSection('Search - Venue', venue);
}

async function runDownload() {
  const paperId = '2510.08996';
  const destinationDir = path.resolve(process.cwd(), 'test-downloads');
  await fs.promises.mkdir(destinationDir, { recursive: true });
  const filename = `${paperId}-smoke.pdf`;
  const downloadPath = path.join(destinationDir, filename);

  if (fs.existsSync(downloadPath)) {
    await fs.promises.unlink(downloadPath);
  }

  const [detail, download] = await Promise.all([
    fetchPaperDetail('arxiv', paperId),
    downloadPaper({
      source: 'arxiv',
      paperId,
      downloadFolder: destinationDir,
      filename,
    }),
  ]);

  logSection('Download', {
    ...download,
    paper: sanitizePaper(detail),
  });
}

async function runKimi() {
  const faqs = await getKimiAnalysis('arxiv', '2412.21139');
  logSection('Kimi Analysis (first 2)', {
    entries: faqs.slice(0, 2),
    total: faqs.length,
  });
}

async function main() {
  await runSearches();
  await runDownload();
  await runKimi();
}

main().catch((error) => {
  console.error('Smoke tests failed:', error);
  process.exitCode = 1;
});
