import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pipeline as streamPipeline } from 'stream';
import {
  DownloadOptions,
  DownloadResult,
  KimiQA,
  PaperSource,
  PaperSummary,
  SearchOptions,
  SearchResult,
} from './types.js';

const BASE_URL = 'https://papers.cool';
const pipeline = promisify(streamPipeline);

function buildSearchUrl(options: SearchOptions): string {
  const params = new URLSearchParams();
  params.set('query', options.query);
  if (typeof options.maxResults === 'number') {
    params.set('show', options.maxResults.toString());
  }
  if (typeof options.skip === 'number') {
    params.set('skip', options.skip.toString());
  }
  if (typeof options.sort === 'number') {
    params.set('sort', options.sort.toString());
  }
  return `${BASE_URL}/${options.source}/search?${params.toString()}`;
}

function parseIntFromText(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/[^\d]/g, '');
  if (!cleaned) return undefined;
  const value = parseInt(cleaned, 10);
  return Number.isNaN(value) ? undefined : value;
}

function normaliseKeywords(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function ensureAbsoluteUrl(href?: string): string | undefined {
  if (!href) return undefined;
  if (href.startsWith('http')) return href;
  return `${BASE_URL}${href}`;
}

function parsePaperElement(
  source: PaperSource,
  paperElement: AnyNode
): PaperSummary {
  const $paper = cheerio.load(paperElement);
  const root = $paper.root().children().first();

  const id = root.attr('id') ?? '';

  const rankText = root.find('span.index').first().text().trim();
  const rank = parseIntFromText(rankText) ?? 0;

  const titleLink = root.find('a.title-link').first();
  const title = titleLink.text().trim();
  const detailUrl = ensureAbsoluteUrl(titleLink.attr('href')) ?? '';

  const externalUrl = (() => {
    let url: string | undefined;
    root.find('h2.title a').each((_, anchor) => {
      const href = $paper(anchor).attr('href');
      if (href && href.startsWith('http')) {
        url = href;
        return false;
      }
      return undefined;
    });
    return url ?? detailUrl;
  })();

  const pdfAnchor = root.find('a.title-pdf').first();
  const pdfUrl = pdfAnchor.attr('data');
  const pdfStars = parseIntFromText(pdfAnchor.find('sup').text());

  const kimiStars = parseIntFromText(
    root.find('a.title-kimi sup').first().text()
  );
  const authors = root
    .find('p.metainfo.authors a.author')
    .map((_, anchor) => $paper(anchor).text().trim())
    .get();

  const abstract = root.find('p.summary').text().trim();

  const subjects = root
    .find('p.metainfo.subjects a')
    .map((_, anchor) => $paper(anchor).text().trim())
    .get();

  const publishTime = root.find('p.metainfo.date span.date-data').text().trim();

  const keywords = normaliseKeywords(root.attr('keywords'));

  return {
    id,
    source,
    rank,
    title,
    detailUrl,
    externalUrl,
    pdfUrl,
    pdfStars,
    kimiStars,
    authors,
    abstract,
    subjects,
    publishTime: publishTime || undefined,
    relatedKeywords: keywords,
  };
}

function parseSearchHtml(
  source: PaperSource,
  query: string,
  html: string
): SearchResult {
  const $ = cheerio.load(html);
  const totalText = $('p.info').first().text();
  const total = parseIntFromText(totalText) ?? 0;

  const papers: PaperSummary[] = [];
  $('div.papers div.panel.paper').each((_, element) => {
    papers.push(parsePaperElement(source, element));
  });

  return {
    source,
    query,
    total,
    papers,
  };
}

export async function searchPapers(options: SearchOptions): Promise<SearchResult> {
  const url = buildSearchUrl(options);
  const { data } = await axios.get<string>(url, {
    responseType: 'text',
  });
  return parseSearchHtml(options.source, options.query, data);
}

async function getPaperDetail(
  source: PaperSource,
  paperId: string
): Promise<PaperSummary> {
  const url = `${BASE_URL}/${source}/${paperId}`;
  const { data } = await axios.get<string>(url, { responseType: 'text' });
  const result = parseSearchHtml(source, paperId, data);
  const paper = result.papers.find((item) => item.id === paperId);
  if (!paper) {
    throw new Error(`Paper ${paperId} not found on ${source}`);
  }
  return paper;
}

export async function downloadPaper(
  options: DownloadOptions
): Promise<DownloadResult> {
  const paper = await getPaperDetail(options.source, options.paperId);
  if (!paper.pdfUrl) {
    throw new Error(`Paper ${options.paperId} does not provide a PDF link`);
  }

  const safeId = options.paperId.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename =
    options.filename && options.filename.trim()
      ? options.filename.trim()
      : `${safeId}.pdf`;
  const destinationDir = options.downloadFolder;

  await fs.promises.mkdir(destinationDir, { recursive: true });
  const filePath = path.resolve(destinationDir, filename);

  const response = await axios.get(paper.pdfUrl, {
    responseType: 'stream',
  });

  let totalBytes = 0;
  response.data.on('data', (chunk: Buffer) => {
    totalBytes += chunk.length;
  });

  await pipeline(response.data, fs.createWriteStream(filePath));

  return {
    pdfUrl: paper.pdfUrl,
    filePath,
    fileSize: totalBytes,
  };
}

export async function getKimiAnalysis(
  source: PaperSource,
  paperId: string
): Promise<KimiQA[]> {
  const url = `${BASE_URL}/${source}/kimi?paper=${encodeURIComponent(paperId)}`;
  const { data } = await axios.get<string>(url, { responseType: 'text' });

  const $ = cheerio.load(data);
  const questions: KimiQA[] = [];

  $('p.faq-q').each((_, questionElement) => {
    const questionText = $(questionElement).text().trim();
    const answerElement = $(questionElement).next('div.faq-a');
    const answerText = answerElement.text().trim().replace(/\s+\n/g, '\n');
    if (questionText && answerText) {
      questions.push({
        question: questionText,
        answer: answerText,
      });
    }
  });

  return questions;
}

export async function fetchPaperDetail(
  source: PaperSource,
  paperId: string
): Promise<PaperSummary> {
  return getPaperDetail(source, paperId);
}
