import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ArxivAPI } from './arxiv.js';
import { DblpAPI } from './dblp.js';
import { Paper, SearchOptions } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

const server = new Server(
  {
    name: 'scholar-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool schemas
const SearchPapersSchema = z.object({
  query: z.string().describe('Search query for academic papers'),
  source: z.enum(['arxiv', 'dblp', 'both']).optional().default('both').describe('Search source: arxiv, dblp, or both'),
  maxResults: z.number().min(1).max(100).optional().default(10).describe('Maximum number of results'),
  startDate: z.string().optional().describe('Start date filter (YYYY-MM-DD format)'),
  endDate: z.string().optional().describe('End date filter (YYYY-MM-DD format)'),
  author: z.string().optional().describe('Author filter'),
  category: z.string().optional().describe('Category filter (arXiv only)'),
});


const DownloadPaperSchema = z.object({
  downloadFolder: z.string().describe('Folder path to download papers to'),
  paperIds: z.array(z.string()).optional().describe('List of arXiv paper IDs to download'),
  query: z.string().optional().describe('Search query to find papers to download'),
  author: z.string().optional().describe('Author name to download their papers'),
  maxResults: z.number().min(1).max(100).optional().default(10).describe('Maximum number of papers to download (for search/author)'),
  startDate: z.string().optional().describe('Start date filter (YYYY-MM-DD format)'),
  endDate: z.string().optional().describe('End date filter (YYYY-MM-DD format)'),
  category: z.string().optional().describe('Category filter (arXiv only)'),
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_papers',
        description: 'Search academic papers on arXiv and DBLP',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for academic papers',
            },
            source: {
              type: 'string',
              enum: ['arxiv', 'dblp', 'both'],
              default: 'both',
              description: 'Search source: arxiv, dblp, or both',
            },
            maxResults: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              default: 10,
              description: 'Maximum number of results',
            },
            startDate: {
              type: 'string',
              description: 'Start date filter (YYYY-MM-DD format)',
            },
            endDate: {
              type: 'string',
              description: 'End date filter (YYYY-MM-DD format)',
            },
            author: {
              type: 'string',
              description: 'Author filter',
            },
            category: {
              type: 'string',
              description: 'Category filter (arXiv only)',
            },
          },
          required: ['query'],
        },
      },
            {
        name: 'download_paper',
        description: 'Download arXiv papers by ID, search query, or author with filtering options',
        inputSchema: {
          type: 'object',
          properties: {
            downloadFolder: {
              type: 'string',
              description: 'Folder path to download papers to',
            },
            paperIds: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'List of arXiv paper IDs to download',
            },
            query: {
              type: 'string',
              description: 'Search query to find papers to download',
            },
            author: {
              type: 'string',
              description: 'Author name to download their papers',
            },
            maxResults: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              default: 10,
              description: 'Maximum number of papers to download (for search/author)',
            },
            startDate: {
              type: 'string',
              description: 'Start date filter (YYYY-MM-DD format)',
            },
            endDate: {
              type: 'string',
              description: 'End date filter (YYYY-MM-DD format)',
            },
            category: {
              type: 'string',
              description: 'Category filter (arXiv only)',
            },
          },
          required: ['downloadFolder'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_papers': {
        const validatedArgs = SearchPapersSchema.parse(args);
        const results = await searchPapers(validatedArgs);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      
      case 'download_paper': {
        const validatedArgs = DownloadPaperSchema.parse(args);
        const result = await downloadPaper(validatedArgs);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }
});

// Tool implementations
async function searchPapers(args: z.infer<typeof SearchPapersSchema>) {
  const { query, source, maxResults, startDate, endDate, author, category } = args;
  const results: Paper[] = [];

  if (source === 'arxiv' || source === 'both') {
    try {
      const arxivResult = await ArxivAPI.searchPapers({
        query,
        maxResults: source === 'both' ? Math.ceil(maxResults / 2) : maxResults,
        startDate,
        endDate,
        author,
        category,
      });
      results.push(...arxivResult.papers);
    } catch (error) {
      console.error('arXiv search failed:', error);
    }
  }

  if (source === 'dblp' || source === 'both') {
    try {
      const dblpResult = await DblpAPI.searchPapers({
        query,
        maxResults: source === 'both' ? Math.ceil(maxResults / 2) : maxResults,
        author,
        year: startDate?.split('-')[0],
      });
      results.push(...dblpResult.papers);
    } catch (error) {
      console.error('DBLP search failed:', error);
    }
  }

  // Sort by publication date (newest first)
  results.sort((a, b) => {
    const dateA = a.published || a.year?.toString() || '';
    const dateB = b.published || b.year?.toString() || '';
    return dateB.localeCompare(dateA);
  });

  return {
    papers: results.slice(0, maxResults),
    totalResults: results.length,
    query,
    sources: source,
  };
}


async function downloadPaper(args: z.infer<typeof DownloadPaperSchema>) {
  const {
    downloadFolder,
    paperIds,
    query,
    author,
    maxResults = 10,
    startDate,
    endDate,
    category
  } = args;

  try {
    // Ensure download folder exists
    if (!fs.existsSync(downloadFolder)) {
      fs.mkdirSync(downloadFolder, { recursive: true });
    }

    interface DownloadedPaper {
      id: string;
      title: string;
      filename: string;
      path: string;
      size: number;
      authors: string[];
      published?: string;
    }

    interface FailedPaper {
      id?: string;
      title?: string;
      reason: string;
    }

    const results = {
      success: true,
      downloaded: [] as DownloadedPaper[],
      failed: [] as FailedPaper[],
      downloadFolder,
      message: ''
    };

    let papersToDownload: Paper[] = [];

    // Method 1: Download by paper IDs
    if (paperIds && paperIds.length > 0) {
      for (const paperId of paperIds) {
        try {
          // Get paper details from arXiv
          const searchResult = await ArxivAPI.searchPapers({
            query: `id:${paperId}`,
            maxResults: 1
          });

          if (searchResult.papers.length > 0) {
            papersToDownload.push(searchResult.papers[0]);
          } else {
            results.failed.push({
              id: paperId,
              reason: 'Paper not found'
            });
          }
        } catch (error) {
          results.failed.push({
            id: paperId,
            reason: `Failed to fetch paper: ${error}`
          });
        }
      }
    }
    // Method 2: Download by search query
    else if (query) {
      const searchResult = await ArxivAPI.searchPapers({
        query,
        maxResults,
        startDate,
        endDate,
        category
      });
      papersToDownload = searchResult.papers;
    }
    // Method 3: Download by author
    else if (author) {
      const searchResult = await ArxivAPI.searchPapers({
        query: '',
        maxResults,
        startDate,
        endDate,
        author,
        category
      });
      papersToDownload = searchResult.papers;
    }
    else {
      throw new Error('Must provide either paperIds, query, or author');
    }

    // Download papers
    for (const paper of papersToDownload) {
      if (!paper.pdfUrl) {
        results.failed.push({
          title: paper.title,
          reason: 'No PDF URL available'
        });
        continue;
      }

      try {
        // Generate safe filename
        const safeTitle = paper.title.replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_');
        const filename = `${paper.id || safeTitle}.pdf`;
        const filePath = path.join(downloadFolder, filename);

        // Download PDF
        const response = await fetch(paper.pdfUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Save file
        fs.writeFileSync(filePath, buffer);

        results.downloaded.push({
          id: paper.id,
          title: paper.title,
          filename,
          path: filePath,
          size: buffer.length,
          authors: paper.authors,
          published: paper.published
        });

        console.log(`Downloaded: ${paper.title} -> ${filePath}`);
      } catch (error) {
        results.failed.push({
          title: paper.title,
          reason: `Download failed: ${error}`
        });
      }
    }

    // Generate summary message
    const successCount = results.downloaded.length;
    const failCount = results.failed.length;

    if (successCount === 0 && failCount === 0) {
      results.message = 'No papers found to download';
    } else if (successCount === 0) {
      results.message = `Failed to download any papers. ${failCount} papers failed.`;
    } else {
      results.message = `Successfully downloaded ${successCount} paper(s)${failCount > 0 ? `, failed to download ${failCount} paper(s)` : ''}`;
    }

    results.success = successCount > 0;
    return results;

  } catch (error) {
    return {
      success: false,
      downloaded: [],
      failed: [],
      downloadFolder,
      message: `Download operation failed: ${error}`
    };
  }
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Scholar MCP server started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});