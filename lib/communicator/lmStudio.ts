// LM Studio client. Moved here from ../SchoolDashboard/lib/communicator so the
// backend owns the model calls directly.
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  LMStudioModelsResponse,
  LMStudioRestModel,
  LMStudioRestModelsResponse,
} from './types';

// OpenAI-compatible base URL for LM Studio (e.g. http://10.0.0.156:1234/v1).
// Required: the previous hard-coded private-IP fallback meant a missing or
// mistyped value failed as a connection timeout on someone else's network
// rather than as a configuration error.
const LM_STUDIO_ENDPOINT = process.env.LM_STUDIO_ENDPOINT;

function requireEndpoint(): string {
  if (!LM_STUDIO_ENDPOINT) {
    throw new Error(
      'LM_STUDIO_ENDPOINT is not configured. Set it to the OpenAI-compatible base URL of your LM Studio server, e.g. http://10.0.0.156:1234/v1',
    );
  }
  return LM_STUDIO_ENDPOINT;
}

// The model every Communicator request uses.
//
// Users used to pick this from a dropdown, which existed while different models
// were being trialled. In practice one model is always the one loaded on the
// LLM box, so the choice was noise that let a user pick something unloaded and
// get a confusing failure. It is configuration now, not a user decision.
// The resolved value is still recorded on each CommunicatorChat, so the history
// shows which model produced any given answer.
const DEFAULT_COMMUNICATOR_MODEL = 'openai/gpt-oss-120b';

export function getCommunicatorModel(): string {
  const configured = process.env.COMMUNICATOR_MODEL?.trim();
  return configured || DEFAULT_COMMUNICATOR_MODEL;
}

export class LMStudioClient {
  // Resolved lazily, not in the constructor: this class is exported as a
  // singleton, so throwing at construction would take the whole server down at
  // import time instead of failing the one request that needs it.
  private get baseUrl(): string {
    return requireEndpoint();
  }

  // REST API endpoint doesn't use the /v1 prefix, so strip it if present
  private get restApiBaseUrl(): string {
    return this.baseUrl.replace(/\/v1\/?$/, '');
  }

  /**
   * Get available models from LM Studio (OpenAI-compatible endpoint)
   * Returns empty array if LM Studio is down
   */
  async getModels(): Promise<LMStudioModelsResponse['data']> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('LM Studio models request failed:', response.statusText);
        return [];
      }

      const data = (await response.json()) as LMStudioModelsResponse;
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch models from LM Studio:', error);
      return [];
    }
  }

  /**
   * Get available models with token limits from LM Studio REST API
   * Uses the /api/v0/models endpoint which includes max_context_length
   * Falls back to OpenAI-compatible endpoint if REST API fails
   */
  async getModelsWithLimits(): Promise<LMStudioRestModel[]> {
    try {
      // Try LM Studio REST API endpoint first (includes token limits)
      // REST API doesn't use /v1 prefix
      const response = await fetch(`${this.restApiBaseUrl}/api/v0/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = (await response.json()) as LMStudioRestModelsResponse;
        return data.data || [];
      }

      // Fallback to OpenAI-compatible endpoint if REST API not available
      console.warn(
        'LM Studio REST API not available, falling back to OpenAI-compatible endpoint',
      );
      const openaiModels = await this.getModels();
      // Convert to REST format without token limits
      return openaiModels.map((model) => ({
        id: model.id,
        object: model.object,
        type: 'llm',
        max_context_length: 0, // Unknown from OpenAI-compatible endpoint
      }));
    } catch (error) {
      console.error(
        'Failed to fetch models with limits from LM Studio:',
        error,
      );
      // Fallback to OpenAI-compatible endpoint
      try {
        const openaiModels = await this.getModels();
        return openaiModels.map((model) => ({
          id: model.id,
          object: model.object,
          type: 'llm',
          max_context_length: 0, // Unknown from OpenAI-compatible endpoint
        }));
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Send a chat completion request to LM Studio
   */
  async chatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `LM Studio request failed: ${response.statusText}. ${errorText}`,
      );
    }

    return (await response.json()) as ChatCompletionResponse;
  }

  /**
   * Helper method for simple text completions
   */
  async complete(
    model: string,
    prompt: string,
    systemPrompt?: string,
    temperature: number = 0.7,
    maxTokens?: number,
  ): Promise<string> {
    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system' as const, content: systemPrompt });
    }

    messages.push({ role: 'user' as const, content: prompt });

    const response = await this.chatCompletion({
      model,
      messages,
      temperature,
      ...(maxTokens && { max_tokens: maxTokens }),
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Chat completion with tool calling support
   */
  async chatCompletionWithTools(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    return this.chatCompletion(request);
  }
}

// Export singleton instance
export const lmStudio = new LMStudioClient();
