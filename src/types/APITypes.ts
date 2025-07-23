import { Type } from "@google/genai";

// API Response Schema for Google GenAI
export const responseSchema = {
  type: Type.OBJECT,
  properties: {
    story: { 
      type: Type.STRING, 
      description: "Phần văn bản tường thuật của câu chuyện, bao gồm các định dạng đặc biệt và các thẻ lệnh ẩn." 
    },
    choices: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Một mảng gồm 4-5 lựa chọn cho người chọi."
    },
  },
  required: ['story', 'choices']
};

// TypeScript interface for the API response
export interface AIResponse {
  story: string;
  choices: string[];
}

// API Configuration interface
export interface AIConfig {
  systemInstruction: string;
  responseMimeType: "application/json";
  responseSchema: typeof responseSchema;
  maxOutputTokens: number;
  thinkingConfig?: {
    thinkingBudget: number;
  };
}

// Generation request interface
export interface GenerationRequest {
  model: string;
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }>;
  config: AIConfig;
}