import { generateObject } from 'ai';
import { z } from 'zod';

import { getModel, trimPrompt } from './ai/providers';
import { systemPrompt } from './prompt';

export async function translateToChineseUtil(content: string): Promise<string> {
  try {
    const res = await generateObject({
      model: getModel(),
      system: systemPrompt(),
      prompt: trimPrompt(
        `Translate the following content into Chinese (中文). Maintain the markdown formatting, structure, and all formatting elements. Keep all URLs, links, and technical terms appropriately translated or transliterated. Make sure the translation is natural and fluent in Chinese:\n\n${content}`
      ),
      schema: z.object({
        translatedContent: z.string().describe('Content translated into Chinese, maintaining markdown formatting'),
      }),
    });

    return res.object.translatedContent;
  } catch (error) {
    console.error('Error translating content to Chinese:', error);
    // Return original content if translation fails
    return content;
  }
} 