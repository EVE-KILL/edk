/**
 * AI Tool Type Definitions
 */

export interface AIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface AIToolResult {
  html?: string;
  stats?: any;
  error?: string;
}

export interface AIToolContext {
  database: any;
  render: any;
  logger: any;
}

export interface AITool {
  definition: AIToolDefinition;
  execute: (args: any, context: AIToolContext) => Promise<AIToolResult>;
}
