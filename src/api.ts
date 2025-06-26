import cors from 'cors';
import express, { Request, Response } from 'express';

import { deepResearch, writeFinalAnswer, writeFinalReport } from './deep-research';
import { generateFeedback } from './feedback';
import { translateToChineseUtil } from './utils';

const app = express();
const port = process.env.PORT || 3051;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

// API endpoint to run research
app.post('/api/research', async (req: Request, res: Response) => {
  try {
    const { 
      query, 
      depth = 2, 
      breadth = 4, 
      mode = 'answer',
      followUpQuestions = [],
      followUpAnswers = []
    } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // If followUpAnswers provided but don't match followUpQuestions length
    if (followUpAnswers.length > 0 && followUpQuestions.length !== followUpAnswers.length) {
      return res.status(400).json({ 
        error: 'followUpQuestions and followUpAnswers arrays must have the same length' 
      });
    }

    let combinedQuery = query;
    
    // If mode is report and follow-up Q&A provided, combine them
    if (mode === 'report' && followUpQuestions.length > 0 && followUpAnswers.length > 0) {
      combinedQuery = `
Initial Query: ${query}
Follow-up Questions and Answers:
${followUpQuestions.map((q: string, i: number) => `Q: ${q}\nA: ${followUpAnswers[i]}`).join('\n')}
`;
    }

    log('\nStarting research...\n');

    const { learnings, visitedUrls } = await deepResearch({
      query: combinedQuery,
      breadth,
      depth,
    });

    log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
    log(
      `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
    );

    if (mode === 'report') {
      const report = await writeFinalReport({
        prompt: combinedQuery,
        learnings,
        visitedUrls,
      });

      return res.json({
        success: true,
        report,
        learnings,
        visitedUrls,
      });
    } else {
      const answer = await writeFinalAnswer({
        prompt: combinedQuery,
        learnings,
      });

      return res.json({
        success: true,
        answer,
        learnings,
        visitedUrls,
      });
    }
  } catch (error: unknown) {
    console.error('Error in research API:', error);
    return res.status(500).json({
      error: 'An error occurred during research',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// generate report API
app.post('/api/generate-report', async (req: Request, res: Response) => {
  try {
    const { 
      query, 
      depth = 2, 
      breadth = 4,
      followUpQuestions = [],
      followUpAnswers = []
    } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // If followUpAnswers provided but don't match followUpQuestions length
    if (followUpAnswers.length > 0 && followUpQuestions.length !== followUpAnswers.length) {
      return res.status(400).json({ 
        error: 'followUpQuestions and followUpAnswers arrays must have the same length' 
      });
    }

    let combinedQuery = query;
    
    // If follow-up Q&A provided, combine them
    if (followUpQuestions.length > 0 && followUpAnswers.length > 0) {
      combinedQuery = `
Initial Query: ${query}
Follow-up Questions and Answers:
${followUpQuestions.map((q: string, i: number) => `Q: ${q}\nA: ${followUpAnswers[i]}`).join('\n')}
`;
    }

    log('\nStarting research...\n');
    
    const { learnings, visitedUrls } = await deepResearch({
      query: combinedQuery,
      breadth,
      depth,
    });

    log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
    log(
      `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
    );
    
    const report = await writeFinalReport({
      prompt: combinedQuery,
      learnings,
      visitedUrls,
    });

    // Translate the report to Chinese
    // log('Translating report to Chinese...');
    // const translatedReport = await translateToChineseUtil(report);

    // Return the results properly
    return res.json({
      success: true,
      report,
      learnings,
      visitedUrls,
    });
    
  } catch (error: unknown) {
    console.error('Error in generate report API:', error);
    return res.status(500).json({
      error: 'An error occurred during research',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Generate follow-up questions API
app.post('/api/generate-feedback', async (req: Request, res: Response) => {
  try {
    const { query, numQuestions = 3 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    log('\nGenerating follow-up questions...\n');
    
    const questions = await generateFeedback({
      query,
      numQuestions,
    });

    return res.json({
      success: true,
      questions,
    });
    
  } catch (error: unknown) {
    console.error('Error in generate feedback API:', error);
    return res.status(500).json({
      error: 'An error occurred while generating follow-up questions',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Deep Research API running on port ${port}`);
});

export default app;
