import FirecrawlApp from '@mendable/firecrawl-js';
import { generateObject } from 'ai';
import { compact } from 'lodash-es';
import pLimit from 'p-limit';
import { z } from 'zod';

import { getModel, trimPrompt } from './ai/providers';
import { systemPrompt } from './prompt';

const axios = require('axios');

const apiKey = process.env.SERPER_API_KEY || process.env.SERPAPI_KEY

const serperClient = axios.create({
  baseURL: 'https://google.serper.dev',
  headers: {
    'X-API-KEY': apiKey,
    'Content-Type': 'application/json'
  }
});

function log(...args: any[]) {
  console.log(...args);
}

export type ResearchProgress = {
  currentDepth: number;
  totalDepth: number;
  currentBreadth: number;
  totalBreadth: number;
  currentQuery?: string;
  totalQueries: number;
  completedQueries: number;
};

type ResearchResult = {
  learnings: string[];
  visitedUrls: string[];
};

type ScrapedContent = {
  url: string;
  markdown: string;
};

type SearchAndScrapeResult = {
  data: ScrapedContent[];
};

// increase this if you have higher API rate limits
const ConcurrencyLimit = Number(process.env.FIRECRAWL_CONCURRENCY) || 2;

// Initialize Firecrawl with optional API key and optional base url
const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_KEY ?? '',
  apiUrl: process.env.FIRECRAWL_BASE_URL,
});

// Search using SERPAPI and then scrape URLs using Firecrawl
async function searchAndScrape(query: string, limit: number = 5): Promise<SearchAndScrapeResult> {
  try {
    // Step 1: Get search results from SERPAPI
    log(`Searching with SERPAPI: ${query}`);
    const searchResults = await serperClient.post('/search', { q: query, location: "China", gl: 'cn', 'hl': 'zh-CN', num: limit });
    console.log(searchResults.data);
    // Extract URLs from organic results
    const urls = (searchResults.data.organic || [])
      .slice(0, limit)
      .map((result: any) => result.link)
      .filter((url: string) => url && url.startsWith('http'));

    log(`Found ${urls.length} URLs to scrape`);

    // Step 2: Scrape each URL using Firecrawl
    const scrapeLimit = pLimit(ConcurrencyLimit);
    const scrapedContent = await Promise.all(
      urls.map((url: string) =>
        scrapeLimit(async () => {
          try {
            // Validate URL before scraping
            if (!url || !url.startsWith('http')) {
              log(`Skipping invalid URL: ${url}`);
              return null;
            }

            log(`Scraping: ${url}`);
            
            // Scrape with Firecrawl
            const scrapeResult = await firecrawl.scrapeUrl(url, {
              formats: ['markdown'],
              timeout: 15000,
            });

            // Check if scrapeResult exists and has expected structure
            if (!scrapeResult) {
              log(`Failed to scrape ${url}: No response from Firecrawl`);
              return null;
            }

            console.log(`Scrape result for ${url}:`, {
              success: scrapeResult.success,
              hasMarkdown: !!(scrapeResult as any).markdown,
              error: scrapeResult.error || 'none'
            });

            if (scrapeResult.success && (scrapeResult as any).markdown) {
              return {
                url: url,
                markdown: (scrapeResult as any).markdown,
              };
            } else {
              const errorMsg = scrapeResult.error || 'Unknown error';
              log(`Failed to scrape ${url}: ${errorMsg}`);
              return null;
            }
          } catch (error: any) {
            const errorMsg = error?.message || error?.toString() || 'Unknown error';
            log(`Error scraping ${url}: ${errorMsg}`);
            return null;
          }
        })
      )
    );

    // Filter out failed scrapes
    const validContent = compact(scrapedContent);
    log(`Successfully scraped ${validContent.length}/${urls.length} URLs`);

    return {
      data: validContent,
    };
  } catch (error) {
    log('Error in searchAndScrape:', error);
    return {
      data: [],
    };
  }
}

// take en user query, return a list of SERP queries
async function generateSerpQueries({
  query,
  numQueries = 3,
  learnings,
}: {
  query: string;
  numQueries?: number;

  // optional, if provided, the research will continue from the last learning
  learnings?: string[];
}) {
  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: `Given the following prompt from the user, generate a list of SERP queries to research the topic with a strong focus on NEWS and RECENT DEVELOPMENTS. Prioritize current events, breaking news, recent announcements, and latest developments related to the topic. Include specific news-oriented keywords like "news", "latest", "recent", "2024", "2025", "breaking", "update", "announcement" in your queries. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>\n\n${
      learnings
        ? `Here are some learnings from previous research, use them to generate more specific NEWS-FOCUSED queries: ${learnings.join(
            '\n',
          )}`
        : ''
    }`,
    schema: z.object({
      queries: z
        .array(
          z.object({
            query: z.string().describe('The SERP query'),
            researchGoal: z
              .string()
              .describe(
                'First talk about the goal of the NEWS-FOCUSED research that this query is meant to accomplish, emphasizing current events and recent developments. Then go deeper into how to advance the research once the results are found, mentioning additional research directions that focus on breaking news, latest updates, and recent announcements. Be as specific as possible about news sources and current events.',
              ),
          }),
        )
        .describe(`List of SERP queries, max of ${numQueries}`),
    }),
  });
  log(`Created ${res.object.queries.length} queries`, res.object.queries);

  return res.object.queries.slice(0, numQueries);
}

async function processSerpResult({
  query,
  result,
  numLearnings = 3,
  numFollowUpQuestions = 3,
}: {
  query: string;
  result: SearchAndScrapeResult;
  numLearnings?: number;
  numFollowUpQuestions?: number;
}) {
  const contents = compact(result.data.map((item: ScrapedContent) => item.markdown)).map((content: string) =>
    trimPrompt(content, 25_000),
  );
  log(`Ran ${query}, found ${contents.length} contents`);

  const res = await generateObject({
    model: getModel(),
    abortSignal: AbortSignal.timeout(60_000),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following contents from a SERP search for the query <query>${query}</query>, generate a list of learnings from the contents. Return a maximum of ${numLearnings} learnings, but feel free to return less if the contents are clear. Make sure each learning is unique and not similar to each other. The learnings should be concise and to the point, as detailed and information dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.\n\n<contents>${contents
        .map(content => `<content>\n${content}\n</content>`)
        .join('\n')}</contents>`,
    ),
    schema: z.object({
      learnings: z.array(z.string()).describe(`List of learnings, max of ${numLearnings}`),
      followUpQuestions: z
        .array(z.string())
        .describe(
          `List of follow-up questions to research the topic further, max of ${numFollowUpQuestions}`,
        ),
    }),
  });
  log(`Created ${res.object.learnings.length} learnings`, res.object.learnings);

  return res.object;
}

export async function writeFinalReport({
  prompt,
  learnings,
  visitedUrls,
}: {
  prompt: string;
  learnings: string[];
  visitedUrls: string[];
}) {
  const learningsString = learnings
    .map(learning => `<learning>\n${learning}\n</learning>`)
    .join('\n');

  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following prompt from the user, write a final report on the topic using the learnings from research. Write the entire report in Chinese (中文). Make it as detailed as possible, aim for 3 or more pages, include ALL the learnings from research. Use proper Chinese formatting and terminology:\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from previous research:\n\n<learnings>\n${learningsString}\n</learnings>`,
    ),
    schema: z.object({
      reportMarkdown: z.string().describe('Final report on the topic in Markdown, written in Chinese'),
    }),
  });

  // Append the visited URLs section to the report
  const urlsSection = `\n\n## Sources\n\n${visitedUrls.map(url => `- ${url}`).join('\n')}`;
  return res.object.reportMarkdown + urlsSection;
}

export async function writeFinalAnswer({
  prompt,
  learnings,
}: {
  prompt: string;
  learnings: string[];
}) {
  const learningsString = learnings
    .map(learning => `<learning>\n${learning}\n</learning>`)
    .join('\n');

  const res = await generateObject({
    model: getModel(),
    system: systemPrompt(),
    prompt: trimPrompt(
      `Given the following prompt from the user, write a final answer on the topic using the learnings from research. Follow the format specified in the prompt. Do not yap or babble or include any other text than the answer besides the format specified in the prompt. Keep the answer as concise as possible - usually it should be just a few words or maximum a sentence. Try to follow the format specified in the prompt (for example, if the prompt is using Latex, the answer should be in Latex. If the prompt gives multiple answer choices, the answer should be one of the choices).\n\n<prompt>${prompt}</prompt>\n\nHere are all the learnings from research on the topic that you can use to help answer the prompt:\n\n<learnings>\n${learningsString}\n</learnings>`,
    ),
    schema: z.object({
      exactAnswer: z
        .string()
        .describe('The final answer, make it short and concise, just the answer, no other text'),
    }),
  });

  return res.object.exactAnswer;
}

export async function deepResearch({
  query,
  breadth,
  depth,
  learnings = [],
  visitedUrls = [],
  onProgress,
}: {
  query: string;
  breadth: number;
  depth: number;
  learnings?: string[];
  visitedUrls?: string[];
  onProgress?: (progress: ResearchProgress) => void;
}): Promise<ResearchResult> {
  const progress: ResearchProgress = {
    currentDepth: depth,
    totalDepth: depth,
    currentBreadth: breadth,
    totalBreadth: breadth,
    totalQueries: 0,
    completedQueries: 0,
  };

  const reportProgress = (update: Partial<ResearchProgress>) => {
    Object.assign(progress, update);
    onProgress?.(progress);
  };

  const serpQueries = await generateSerpQueries({
    query,
    learnings,
    numQueries: breadth,
  });

  reportProgress({
    totalQueries: serpQueries.length,
    currentQuery: serpQueries[0]?.query,
  });

  const limit = pLimit(ConcurrencyLimit);

  const results = await Promise.all(
    serpQueries.map(serpQuery =>
      limit(async () => {
        try {
          const result = await searchAndScrape(serpQuery.query, 5);

          // Collect URLs from this search
          const newUrls = result.data.map(item => item.url);
          const newBreadth = Math.ceil(breadth / 2);
          const newDepth = depth - 1;

          const newLearnings = await processSerpResult({
            query: serpQuery.query,
            result,
            numFollowUpQuestions: newBreadth,
          });
          const allLearnings = [...learnings, ...newLearnings.learnings];
          const allUrls = [...visitedUrls, ...newUrls];

          if (newDepth > 0) {
            log(`Researching deeper, breadth: ${newBreadth}, depth: ${newDepth}`);

            reportProgress({
              currentDepth: newDepth,
              currentBreadth: newBreadth,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });

            const nextQuery = `
            Previous research goal: ${serpQuery.researchGoal}
            Follow-up research directions: ${newLearnings.followUpQuestions.map(q => `\n${q}`).join('')}
          `.trim();

            return deepResearch({
              query: nextQuery,
              breadth: newBreadth,
              depth: newDepth,
              learnings: allLearnings,
              visitedUrls: allUrls,
              onProgress,
            });
          } else {
            reportProgress({
              currentDepth: 0,
              completedQueries: progress.completedQueries + 1,
              currentQuery: serpQuery.query,
            });
            return {
              learnings: allLearnings,
              visitedUrls: allUrls,
            };
          }
        } catch (e: any) {
          if (e.message && e.message.includes('Timeout')) {
            log(`Timeout error running query: ${serpQuery.query}: `, e);
          } else {
            log(`Error running query: ${serpQuery.query}: `, e);
          }
          return {
            learnings: [],
            visitedUrls: [],
          };
        }
      }),
    ),
  );

  return {
    learnings: [...new Set(results.flatMap(r => r.learnings))],
    visitedUrls: [...new Set(results.flatMap(r => r.visitedUrls))],
  };
}
