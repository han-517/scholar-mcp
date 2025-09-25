import axios from 'axios';
import * as xml2js from 'xml2js';

const ARXIV_API_BASE = 'http://export.arxiv.org/api/query';

export class ArxivAPI {
  private static async queryAPI(params: Record<string, string>): Promise<any> {
    try {
      const response = await axios.get(ARXIV_API_BASE, { params });
      return await xml2js.parseStringPromise(response.data);
    } catch (error) {
      throw new Error(`arXiv API request failed: ${error}`);
    }
  }

  static async searchPapers(options: {
    query: string;
    maxResults?: number;
    startDate?: string;
    endDate?: string;
    author?: string;
    category?: string;
  }) {
    const { query, maxResults = 10, startDate, endDate, author, category } = options;

    let searchQuery = query;

    if (author) {
      searchQuery += ` au:${author}`;
    }

    if (category) {
      searchQuery += ` cat:${category}`;
    }

    if (startDate || endDate) {
      const dateFilter = [];
      if (startDate) dateFilter.push(startDate);
      if (endDate) dateFilter.push(endDate);
      searchQuery += ` submittedDate:[${dateFilter.join(' TO ')}]`;
    }

    
    const params = {
      search_query: searchQuery,
      start: '0',
      max_results: maxResults.toString(),
      sortBy: 'submittedDate',
      sortOrder: 'descending'
    };

    const data = await this.queryAPI(params);
    return this.parseResponse(data);
  }

  private static parseResponse(data: any) {
    const feed = data.feed;
    const entries = feed.entry || [];

    
    const papers = entries.map((entry: any) => ({
      id: entry.id[0].split('/').pop()?.replace('v\\d+$', '') || '',
      title: entry.title[0].replace(/\s+/g, ' ').trim(),
      authors: entry.author?.map((author: any) => author.name[0]) || [],
      abstract: entry.summary?.[0]?.replace(/\s+/g, ' ').trim(),
      published: entry.published?.[0],
      updated: entry.updated?.[0],
      categories: entry.category?.map((cat: any) => cat.$.term) || [],
      pdfUrl: entry.link?.find((link: any) => link.$.title === 'pdf')?.$.href,
      source: 'arxiv' as const
    }));

    const totalResults = feed['opensearch:totalResults']?.[0]?._ ?
      parseInt(feed['opensearch:totalResults'][0]._.toString()) : papers.length;

    const startIndex = feed['opensearch:startIndex']?.[0]?._ ?
      parseInt(feed['opensearch:startIndex'][0]._.toString()) : 0;
    const itemsPerPage = feed['opensearch:itemsPerPage']?.[0]?._ ?
      parseInt(feed['opensearch:itemsPerPage'][0]._.toString()) : papers.length;

    return {
      papers,
      totalResults,
      startIndex,
      itemsPerPage
    };
  }
}