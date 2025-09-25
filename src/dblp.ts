import axios from 'axios';
import * as cheerio from 'cheerio';

const DBLP_API_BASE = 'https://dblp.org/search/publ/api';
const DBLP_BASE = 'https://dblp.org';

export class DblpAPI {
  private static async queryAPI(params: Record<string, string>): Promise<any> {
    try {
      const response = await axios.get(DBLP_API_BASE, {
        params,
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      return response.data;
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`DBLP API timeout: ${error.message}`);
      } else if (error.response) {
        throw new Error(`DBLP API returned ${error.response.status}: ${error.response.statusText}`);
      } else {
        throw new Error(`DBLP API request failed: ${error.message}`);
      }
    }
  }

  static async searchPapers(options: {
    query: string;
    maxResults?: number;
    author?: string;
    year?: string;
  }) {
    const { query, maxResults = 10, author, year } = options;

    let searchQuery = query;

    if (author) {
      searchQuery += ` author:${author}`;
    }

    if (year) {
      searchQuery += ` year:${year}`;
    }

    
    const params = {
      q: searchQuery,
      format: 'json',
      h: maxResults.toString(),
      f: '0'
    };

    const data = await this.queryAPI(params);
    return this.parseResponse(data, maxResults);
  }

  private static parseResponse(data: any, maxResults: number) {
    const hits = data.result?.hits?.hit || [];


    const papers = hits.map((hit: any) => {
      const info = hit.info;
      const authors = info.authors?.author || [];

      // 正确提取DBLP ID：从URL中提取完整的路径
      let correctId = hit.id;
      if (info.url) {
        const urlParts = info.url.split('/');
        const recIndex = urlParts.indexOf('rec');
        if (recIndex !== -1) {
          correctId = urlParts.slice(recIndex + 1).join('/');
        }
      }

      return {
        id: correctId,
        url: info.url,
        title: info.title?.replace(/\s+/g, ' ').trim() || '',
        authors: Array.isArray(authors) ? authors.map((author: any) => author.text || author) : [authors],
        year: info.year ? parseInt(info.year) : undefined,
        journal: info.journal || info.venue,
        booktitle: info.booktitle,
        doi: info.doi,
        published: info.year ? `${info.year}-01-01` : undefined,
        pdfUrl: info.ee || this.extractPdfUrl(info.url),
        source: 'dblp' as const
      };
    });

    return {
      papers,
      totalResults: parseInt(data.result?.hits?.['@total'] || '0'),
      startIndex: parseInt(data.result?.hits?.['@sent'] || '0'),
      itemsPerPage: papers.length
    };
  }

  private static extractPdfUrl(url?: string): string | undefined {
    if (!url) return undefined;

    // Try to extract PDF URL from common patterns
    if (url.includes('.pdf')) {
      return url;
    }

    // Some common PDF patterns
    if (url.includes('arxiv.org')) {
      return url.replace(/\/abs\//, '/pdf/') + '.pdf';
    }

    return undefined;
  }

  
  static async searchByAuthor(author: string, maxResults: number = 10) {
    return this.searchPapers({
      query: '',
      author,
      maxResults
    });
  }

  static async searchByYear(query: string, year: string, maxResults: number = 10) {
    return this.searchPapers({
      query,
      year,
      maxResults
    });
  }
}