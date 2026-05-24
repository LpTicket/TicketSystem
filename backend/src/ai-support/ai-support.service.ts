import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus } from '../database/entities';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * AiSupportService
 * Provides AI-powered customer support capabilities using OpenAI.
 * Dynamically loads its personality and instructions from a text file.
 */
@Injectable()
export class AiSupportService implements OnModuleInit {
  private openai: OpenAI;
  private systemPrompt: string;
  private readonly logger = new Logger(AiSupportService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  /**
   * onModuleInit
   * Initializes the OpenAI client and loads the specialized prompt instructions.
   */
  onModuleInit() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not found in environment. AI Chatbot will not function.');
      return;
    }
    this.openai = new OpenAI({ apiKey });
    
    this.loadSystemPrompt();
  }

  /**
   * loadSystemPrompt
   * Reads instructions from 'CHAT BOT - AI LP TICKET.txt'.
   * This allows non-technical administrators to update the chatbot's knowledge 
   * without redeploying code.
   */
  private loadSystemPrompt() {
    try {
      // Instruction file lives in the backend root so Railway includes it in the deployment
      const filePath = path.join(process.cwd(), 'chatbot-prompt.txt');
      if (fs.existsSync(filePath)) {
        this.systemPrompt = fs.readFileSync(filePath, 'utf-8');
        this.logger.log('AI System Prompt loaded successfully from root.');
      } else {
        this.logger.error(`AI Instruction file not found at ${filePath}`);
        this.systemPrompt = 'You are a helpful support assistant for LPTicket.com.';
      }
    } catch (err) {
      this.logger.error('Error loading AI system prompt:', err);
      this.systemPrompt = 'You are a helpful support assistant for LPTicket.com.';
    }
  }

  /**
   * getUpcomingEventsPromptContext
   * Dynamically queries the PostgreSQL database for all future published events.
   * Formats the response with event dates, category, locations, starting prices,
   * and clean purchase markdown links so the AI can direct users to buy tickets.
   */
  private async getUpcomingEventsPromptContext(): Promise<string> {
    try {
      const { MoreThanOrEqual } = require('typeorm');
      const events = await this.eventRepo.find({
        where: {
          status: EventStatus.PUBLISHED,
          eventDate: MoreThanOrEqual(new Date()),
        },
        order: { eventDate: 'ASC' },
      });

      if (events.length === 0) {
        return '\n\nActualmente no hay eventos próximos publicados en el sistema.';
      }

      const appUrl = (this.configService.get<string>('APP_URL') || 'https://lpticket.com').replace(/\/$/, '');

      let context = '\n\n==================================================\n';
      context += 'DATOS EN TIEMPO REAL - EVENTOS PRÓXIMOS EN LPTICKET:\n';
      context += 'Usa la siguiente lista exacta para recomendar y responder al usuario. Cuando el usuario pregunte por un evento o por los eventos de un mes específico (ej. "eventos de mayo", "concierto", etc.), descríbele los detalles e INCLUYE OBLIGATORIAMENTE el enlace Markdown exacto para comprar entradas:\n\n';

      events.forEach(event => {
        const dateObj = new Date(event.eventDate);
        // Use event timezone if available, otherwise fall back to America/Chicago (Houston)
        const tz = (event as any).timezone || 'America/Chicago';
        const dateStr = dateObj.toLocaleDateString('es-ES', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: tz,
        });
        
        // Month helper for the AI to filter easily (use same timezone)
        const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const monthIndex = Number(dateObj.toLocaleString('en-US', { month: 'numeric', timeZone: tz })) - 1;
        const monthName = months[monthIndex];

        const eventUrl = `${appUrl}/events/${event.slug}`;
        
        context += `- **Nombre**: "${event.title}"\n`;
        context += `  * Categoría: ${event.category || 'General'}\n`;
        context += `  * Fecha y Hora: ${dateStr} (Mes: ${monthName})\n`;
        context += `  * Lugar/Recinto: ${event.venueName || 'Por confirmar'}\n`;
        context += `  * Precio mínimo: $${event.minPrice || 0} ${event.currency || 'USD'}\n`;
        context += `  * Enlace directo para comprar: [Comprar entradas para ${event.title}](${eventUrl})\n\n`;
      });
      context += '==================================================\n';

      return context;
    } catch (error) {
      this.logger.error('Error fetching upcoming events for chatbot context:', error);
      return '';
    }
  }

  /**
   * generateResponse
   * Interacts with OpenAI's Chat Completion API.
   * Uses gpt-4o-mini with real-time PostgreSQL events context for up-to-date recommendations.
   * 
   * @param messages Conversation history including the latest user query
   */
  async generateResponse(messages: any[]) {
    if (!this.openai) {
      return { 
        content: 'El servicio de IA no está configurado correctamente (falta la API Key). Por favor, contacta al administrador.',
        error: true 
      };
    }

    try {
      // Reload system instructions from text file to support hot-updates
      this.loadSystemPrompt();

      // Retrieve dynamic real-time event catalog
      const eventsContext = await this.getUpcomingEventsPromptContext();
      const fullSystemPrompt = `${this.systemPrompt || 'You are a helpful support assistant for LPTicket.com.'}${eventsContext}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 600,
      });

      return {
        content: response.choices[0].message.content,
        error: false
      };
    } catch (err) {
      this.logger.error('OpenAI Chat Completions failed:', err);
      return {
        content: 'Lo siento, hubo un error al procesar tu solicitud. Por favor intenta de nuevo más tarde.',
        error: true
      };
    }
  }
}
