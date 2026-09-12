// Ported from the standalone communicator service (src/types/index.ts).

// LM Studio types (OpenAI-compatible)
export interface LMStudioModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface LMStudioModelsResponse {
  object: string;
  data: LMStudioModel[];
}

// LM Studio REST API types (includes token limits)
export interface LMStudioRestModel {
  id: string;
  object: string;
  type: string;
  publisher?: string;
  arch?: string;
  compatibility_type?: string;
  quantization?: string;
  state?: string;
  max_context_length: number;
}

export interface LMStudioRestModelsResponse {
  data: LMStudioRestModel[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: Tool[];
  tool_choice?: string | { type: 'function'; function: { name: string } };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// GraphQL types
export interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
}

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
    extensions?: {
      code?: string;
      [key: string]: any;
    };
  }>;
}

// API Request/Response types
export interface ModelsResponse {
  models: Array<{
    id: string;
    name: string;
    available: boolean;
    maxContextLength?: number; // Token limit / context window size
  }>;
}

export interface QueryRequest {
  question: string;
  model: string;
  includeRawData?: boolean;
  userId?: string;
  userName?: string;
}

export interface QueryResponse {
  question: string;
  explanation: string;
  graphqlQuery: string;
  rawData?: any;
  timestamp: string;
  iterations?: number;
  evaluationScore?: number;
}

// Error types
export interface ApiError {
  error: string;
  message: string;
  details?: any;
}
