import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  downloadPaper,
  fetchPaperDetail,
  getKimiAnalysis,
  searchPapers,
} from './cool-papers.js';
import {
  DownloadOptions,
  KimiQA,
  PaperSummary,
  SearchOptions,
  SearchResult,
} from './types.js';

const server = new Server(
  {
    name: 'scholar-mcp',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const SourceEnum = z.enum(['arxiv', 'venue']);

type PublicPaperSummary = Omit<
  PaperSummary,
  'detailUrl' | 'pdfStars' | 'kimiStars'
>;

interface PublicSearchResult
  extends Omit<SearchResult, 'papers'> {
  papers: PublicPaperSummary[];
}

interface DownloadSuccess {
  paper: PublicPaperSummary;
  pdfUrl: string;
  filePath: string;
  fileSize: number;
}

interface DownloadFailure {
  paper: PublicPaperSummary;
  error: string;
}

interface BatchSearchReport extends PublicSearchResult {
  params: {
    maxResults?: number;
    skip?: number;
    sort?: number;
  };
}

interface SingleDownloadPayload {
  mode: 'single';
  download: DownloadSuccess;
}

interface BatchDownloadPayload {
  mode: 'batch';
  search: BatchSearchReport;
  successes: DownloadSuccess[];
  failures: DownloadFailure[];
}

function sanitizePaperSummary(paper: PaperSummary): PublicPaperSummary {
  const { detailUrl: _detail, pdfStars: _pdf, kimiStars: _kimi, ...rest } = paper;
  return rest;
}

function sanitizeSearchResult(results: SearchResult): PublicSearchResult {
  return {
    source: results.source,
    query: results.query,
    total: results.total,
    papers: results.papers.map(sanitizePaperSummary),
  };
}

const SearchPapersSchema = z.object({
  source: SourceEnum.default('arxiv').describe('Data source: arxiv (preprints) or venue (published works)'),
  query: z.string().min(1).describe('Search keywords'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Limit result count (passed through to Cool Papers as the show parameter); use 3 for precise targeting, 10-20 for general use to control cost'),
  skip: z.number().int().min(0).optional().describe('Offset results using the skip parameter'),
  sort: z
    .number()
    .int()
    .min(0)
    .max(2)
    .optional()
    .describe('Sorting flag passed through to Cool Papers (0=date desc, 1=reading stars desc)'),
});

const DownloadSinglePaperSchema = z.object({
  source: SourceEnum.describe('Data source for the target paper'),
  downloadFolder: z
    .string()
    .min(1)
    .describe('Absolute or relative folder path where the PDF will be saved'),
  paperId: z
    .string()
    .trim()
    .min(1)
    .describe('Paper identifier (e.g. 2412.21139) to download'),
  filename: z
    .string()
    .optional()
    .describe('Optional filename override to use for the downloaded PDF'),
});

const DownloadBatchPapersSchema = z.object({
  source: SourceEnum.describe('Data source for the papers to download'),
  downloadFolder: z
    .string()
    .min(1)
    .describe('Absolute or relative folder path where PDFs will be saved'),
  query: z
    .string()
    .trim()
    .min(1)
    .describe('Keyword query to select papers for batch download'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Limit batch downloads to the first N results (passed through as the show parameter); set 3 for precise pulls, 10-20 for routine batches to limit cost'),
  skip: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Skip the first N search results before downloading'),
  sort: z
    .number()
    .int()
    .min(0)
    .max(2)
    .optional()
    .describe('Sorting flag passed through to Cool Papers (0=newest, 1=top reading stars)'),
});

const KimiAnalysisSchema = z.object({
  source: SourceEnum.describe('Data source where the paper is listed'),
  paperId: z.string().min(1).describe('Identifier to request the Kimi FAQ'),
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_papers',
      description: 'Search Cool Papers (arXiv or venue) and return sanitized summaries with PDF links',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            enum: ['arxiv', 'venue'],
            default: 'arxiv',
            description: 'Choose between arxiv or venue listings',
          },
          query: {
            type: 'string',
            description: 'Keywords to search for',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of items to return (passed as Cool Papers show); set 3 for precision, 10-20 for typical searches to manage cost',
          },
          skip: {
            type: 'number',
            description: 'Number of items to skip before collecting results',
          },
          sort: {
            type: 'number',
            description: 'Sorting directive (0=newest first, 1=highest reading stars)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'download_single_paper',
      description: 'Download one Cool Papers PDF by explicit paper ID',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            enum: ['arxiv', 'venue'],
            description: 'Source where the paper is listed',
          },
          paperId: {
            type: 'string',
            description: 'Paper identifier (e.g. 2412.21139) to download',
          },
          downloadFolder: {
            type: 'string',
            description: 'Destination folder for the PDF',
          },
          filename: {
            type: 'string',
            description: 'Optional target filename to use for the downloaded PDF',
          },
        },
        required: ['source', 'paperId', 'downloadFolder'],
      },
    },
    {
      name: 'download_batch_papers',
      description: 'Batch download Cool Papers PDFs for results that match a query',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            enum: ['arxiv', 'venue'],
            description: 'Source where matching papers will be fetched',
          },
          query: {
            type: 'string',
            description: 'Keyword query used to select papers from Cool Papers',
          },
          downloadFolder: {
            type: 'string',
            description: 'Destination folder for the downloaded PDFs',
          },
          maxResults: {
            type: 'number',
            description: 'Limit number of results to download (passed as Cool Papers show); use 3 for precise batches, 10-20 for regular pulls to control cost',
          },
          skip: {
            type: 'number',
            description: 'Skip the first N results before downloading',
          },
          sort: {
            type: 'number',
            description: 'Sorting directive (0=newest, 1=top reading stars)',
          },
        },
        required: ['source', 'query', 'downloadFolder'],
      },
    },
    {
      name: 'kimi_analysis',
      description: 'Retrieve Kimi FAQ question/answer pairs for a Cool Papers paper',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            enum: ['arxiv', 'venue'],
            description: 'Source of the target paper',
          },
          paperId: {
            type: 'string',
            description: 'Paper identifier to request the Kimi analysis',
          },
        },
        required: ['source', 'paperId'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_papers': {
        const validated = SearchPapersSchema.parse(args);
        const searchOptions: SearchOptions = {
          source: validated.source,
          query: validated.query,
          maxResults: validated.maxResults,
          skip: validated.skip,
          sort: validated.sort,
        };
        const results: SearchResult = await searchPapers(searchOptions);
        const payload = sanitizeSearchResult(results);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload, null, 2),
            },
          ],
        };
      }

      case 'download_single_paper': {
        const validated = DownloadSinglePaperSchema.parse(args);
        const downloadOptions: DownloadOptions = {
          source: validated.source,
          paperId: validated.paperId,
          downloadFolder: validated.downloadFolder,
        };

        if (validated.filename) {
          downloadOptions.filename = validated.filename;
        }

        const [detail, result] = await Promise.all([
          fetchPaperDetail(downloadOptions.source, downloadOptions.paperId),
          downloadPaper(downloadOptions),
        ]);

        const payload: SingleDownloadPayload = {
          mode: 'single',
          download: {
            paper: sanitizePaperSummary(detail),
            pdfUrl: result.pdfUrl,
            filePath: result.filePath,
            fileSize: result.fileSize,
          },
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload, null, 2),
            },
          ],
        };
      }

      case 'download_batch_papers': {
        const validated = DownloadBatchPapersSchema.parse(args);
        const searchOptions: SearchOptions = {
          source: validated.source,
          query: validated.query,
          maxResults: validated.maxResults,
          skip: validated.skip,
          sort: validated.sort,
        };

        const searchResult = await searchPapers(searchOptions);
        const searchReport: BatchSearchReport = {
          ...sanitizeSearchResult(searchResult),
          params: {
            maxResults: validated.maxResults,
            skip: validated.skip,
            sort: validated.sort,
          },
        };

        const successes: DownloadSuccess[] = [];
        const failures: DownloadFailure[] = [];

        for (const paper of searchResult.papers) {
          try {
            const downloadOutcome = await downloadPaper({
              source: validated.source,
              paperId: paper.id,
              downloadFolder: validated.downloadFolder,
            });

            successes.push({
              paper: sanitizePaperSummary(paper),
              pdfUrl: downloadOutcome.pdfUrl,
              filePath: downloadOutcome.filePath,
              fileSize: downloadOutcome.fileSize,
            });
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : 'Unknown error during download';
            failures.push({
              paper: sanitizePaperSummary(paper),
              error: message,
            });
          }
        }

        const payload: BatchDownloadPayload = {
          mode: 'batch',
          search: searchReport,
          successes,
          failures,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload, null, 2),
            },
          ],
        };
      }

      case 'kimi_analysis': {
        const validated = KimiAnalysisSchema.parse(args);
        const qas: KimiQA[] = await getKimiAnalysis(
          validated.source,
          validated.paperId
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  source: validated.source,
                  paperId: validated.paperId,
                  faqs: qas,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name as string}`);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error during tool call';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

await server.connect(new StdioServerTransport());
