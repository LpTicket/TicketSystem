import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AiSupportService implements OnModuleInit {
  private openai: OpenAI;
  private systemPrompt: string;
  private readonly logger = new Logger(AiSupportService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not found in environment. AI Chatbot will not function.');
      return;
    }
    this.openai = new OpenAI({ apiKey });
    
    this.loadSystemPrompt();
  }

  private loadSystemPrompt() {
    try {
      // Look for the instruction file in the root directory
      const filePath = path.join(process.cwd(), '..', 'CHAT BOT - AI LP TICKET.txt');
      if (fs.existsSync(filePath)) {
        this.systemPrompt = fs.readFileSync(filePath, 'utf-8');
        this.logger.log('AI System Prompt loaded successfully from root.');
      } else {
        // Fallback or log error
        this.logger.error(`AI Instruction file not found at ${filePath}`);
        this.systemPrompt = 'You are a helpful support assistant for LPTicket.com.';
      }
    } catch (err) {
      this.logger.error('Error loading AI system prompt:', err);
      this.systemPrompt = 'You are a helpful support assistant for LPTicket.com.';
    }
  }

  async generateResponse(messages: any[]) {
    if (!this.openai) {
      return { 
        content: 'El servicio de IA no está configurado correctamente (falta la API Key). Por favor, contacta al administrador.',
        error: true 
      };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      return {
        content: response.choices[0].message.content,
        error: false
      };
    } catch (err) {
      this.logger.error('Error calling OpenAI:', err);
      return {
        content: 'Lo siento, hubo un error al procesar tu solicitud. Por favor intenta de nuevo más tarde.',
        error: true
      };
    }
  }
}
