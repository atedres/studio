'use server';
/**
 * @fileOverview An AI-powered form generator for HSE topics.
 *
 * - generateForm - A function that handles the form generation process.
 * - FormGeneratorInput - The input type for the generateForm function.
 * - FormGeneratorOutput - The return type for the generateForm function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const FormGeneratorInputSchema = z.string().describe("The topic for the HSE form, e.g., 'Audit 5S' or 'Dialogue sécurité chariot élévateur'.");
export type FormGeneratorInput = z.infer<typeof FormGeneratorInputSchema>;

const FormGeneratorOutputSchema = z.object({
  title: z.string().describe("The main title for the generated form."),
  description: z.string().describe("A brief description of the form's purpose."),
  fields: z.array(z.object({
    id: z.string().describe("A unique identifier for the field, in kebab-case (e.g., 'auditor-name')."),
    label: z.string().describe("The user-visible label for the form field."),
    type: z.enum(['text', 'textarea', 'select', 'checkbox', 'date', 'file', 'separator', 'title']).describe("The type of the form field. Use 'title' for section headers."),
    placeholder: z.string().optional().describe("Placeholder text for input fields."),
    options: z.array(z.string()).optional().describe("An array of options for 'select' type fields."),
    required: z.boolean().optional().describe("Whether the field is required or not."),
  })).describe("An array of fields that make up the form.")
});
export type FormGeneratorOutput = z.infer<typeof FormGeneratorOutputSchema>;

export async function generateForm(input: FormGeneratorInput): Promise<FormGeneratorOutput> {
  return generateFormFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFormPrompt',
  input: { schema: FormGeneratorInputSchema },
  output: { schema: FormGeneratorOutputSchema },
  prompt: `You are an expert in Health, Safety, and Environment (HSE) management for industrial settings. Your task is to generate a dynamic form based on a given topic.

  The user will provide a topic, and you must create a structured form with relevant fields.

  Guidelines:
  1.  Generate a clear 'title' and 'description' for the form.
  2.  Create an array of 'fields'.
  3.  Use the 'title' field type to create logical sections within the form (e.g., 'Informations Générales', 'Points de Vérification').
  4.  For each field, provide a unique 'id' in kebab-case, a 'label', and the appropriate 'type'.
  5.  Include common fields like 'Date', 'Nom de l'auditeur/observateur', 'Zone/Unité' where relevant.
  6.  For 'select' fields, provide a list of 'options'.
  7.  Keep the forms concise but comprehensive for the given topic.
  8.  All labels and text should be in French.

  Topic: {{{prompt}}}`
});

const generateFormFlow = ai.defineFlow(
  {
    name: 'generateFormFlow',
    inputSchema: FormGeneratorInputSchema,
    outputSchema: FormGeneratorOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
