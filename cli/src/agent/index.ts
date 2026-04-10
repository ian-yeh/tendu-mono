// cli/src/agent/index.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as p from '@clack/prompts';
import color from 'picocolors';
import { AgentConfig } from './types.js';
import { getAgentConfig } from './config.js';

export class Agent {
  private genAI: GoogleGenerativeAI;
  private config: AgentConfig;

  constructor() {
    this.config = getAgentConfig();

    if (!this.config.apiKey) {
      throw new Error(
        'Gemini API Key not found. Please set GOOGLE_API_KEY environment variable.'
      );
    }
    this.genAI = new GoogleGenerativeAI(this.config.apiKey);
  }

  /**
   * Initializes the generative model.
   * Currently uses the 'gemini-pro' model.
   */
  private getModel() {
    // For text-only input, use the gemini-pro model
    // For multi-modal input (text and image), use the gemini-pro-vision model
    return this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  /**
   * Runs a single interaction with the Gemini Pro model.
   */
  async generateResponse(prompt: string): Promise<string | undefined> {
    const spinner = p.spinner();
    spinner.start('Generating response with Gemini...');
    try {
      const model = this.getModel();
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      spinner.stop('Gemini response received.');
      return text;
    } catch (error) {
      spinner.stop('Gemini generation failed.');
      p.log.error(color.red(`Error interacting with Gemini API: ${(error as Error).message}`));
      return undefined;
    }
  }

  /**
   * Implements a basic conversational loop.
   * This is a simplified "brain loop" for demonstration.
   */
  async startConversationLoop(): Promise<void> {
    p.log.info(color.magenta('Agent conversation started (type "exit" to quit)'));
    let history: { role: string; parts: string }[] = [];
    
    // For multi-turn conversations (chat), use the chat model
    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    const chat = model.startChat({
      history: [],
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    while (true) {
      const userInput = await p.text({
        message: color.blue('You:'),
        placeholder: 'Enter your message...',
        validate: (value) => {
          if (!value) return 'Please enter a message.';
        },
      });

      if (p.isCancel(userInput)) {
        p.log.info('Conversation cancelled.');
        break;
      }

      if (userInput.toLowerCase() === 'exit') {
        p.log.info('Exiting conversation.');
        break;
      }

      history.push({ role: 'user', parts: userInput });

      const spinner = p.spinner();
      spinner.start('Agent thinking...');
      try {
        const result = await chat.sendMessage(userInput);
        const responseText = result.response.text();
        spinner.stop('Agent replied.');
        p.log.message(color.green(`Agent: ${responseText}`));
        history.push({ role: 'model', parts: responseText });
      } catch (error) {
        spinner.stop('Agent failed to reply.');
        p.log.error(color.red(`Error in conversation: ${(error as Error).message}`));
      }
    }
    p.outro('Conversation ended.');
  }
}
