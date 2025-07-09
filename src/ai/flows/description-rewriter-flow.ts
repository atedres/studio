
'use server';
/**
 * @fileOverview An AI-powered text rewriter for HSE descriptions.
 *
 * - rewriteDescription - A function that rewrites a given text to be more professional.
 * - RewriteDescriptionInput - The input type for the rewriteDescriptionFlow.
 * - RewriteDescriptionOutput - The return type for the rewriteDescription function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const RewriteDescriptionInputSchema = z.object({
  description: z.string().describe('The text to be rewritten.')
});
export type RewriteDescriptionInput = z.infer<typeof RewriteDescriptionInputSchema>;

const RewriteDescriptionOutputSchema = z.string().describe('The rewritten, improved text.');
export type RewriteDescriptionOutput = z.infer<typeof RewriteDescriptionOutputSchema>;

// This is the function called by the client-side code. It takes a string.
export async function rewriteDescription(description: string): Promise<RewriteDescriptionOutput> {
  // It wraps the string in the object expected by the flow.
  return rewriteDescriptionFlow({ description });
}

// The output schema has been removed from the prompt definition to prevent validation errors
// when the model returns a null or empty response. The flow will handle the response instead.
const prompt = ai.definePrompt({
  name: 'rewriteDescriptionPrompt',
  input: { schema: RewriteDescriptionInputSchema },
  prompt: `You are an expert in Health, Safety, and Environment (HSE) for industrial settings.
Your task is to rewrite the user's description of an anomaly to be more clear, professional, and precise.
The output should be only the rewritten text, without any preamble or explanation. The language must be French.

Original description: {{{description}}}
`,
});

const rewriteDescriptionFlow = ai.defineFlow(
  {
    name: 'rewriteDescriptionFlow',
    inputSchema: RewriteDescriptionInputSchema,
    outputSchema: RewriteDescriptionOutputSchema,
  },
  async (input) => {
    // When a prompt has no output schema, it returns a GenerateResponse object.
    const response = await prompt(input);
    
    // We access the model's text output and ensure we return a string,
    // even if the response is empty, to satisfy the flow's output schema.
    return response.text || "";
  }
);
