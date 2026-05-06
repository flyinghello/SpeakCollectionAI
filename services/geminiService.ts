import { CapacitorHttp } from "@capacitor/core";
import { AnalysisResult } from "../types";
import { getSettings } from "./storageService";

// Default configuration for Volcengine (Doubao)
const DEFAULT_MODEL_ID = "doubao-1-5-pro-32k-250115";
const VOLCENGINE_API_BASE = "https://ark.cn-beijing.volces.com/api/v3";

const extractApiErrorMessage = (responseText: string): string => {
  try {
    const parsed = JSON.parse(responseText) as {
      error?: { message?: string; code?: string; type?: string };
      message?: string;
    };
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
  } catch {
    // Keep raw text fallback for non-JSON responses.
  }
  return responseText.slice(0, 300);
};

const requestChatCompletions = async (
  endpoint: string,
  apiKey: string,
  body: Record<string, unknown>,
  inNative: boolean
): Promise<string> => {
  if (inNative) {
    const response = await CapacitorHttp.request({
      url: endpoint,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      data: body,
      responseType: "text",
    });
    const responseText = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
    if (response.status < 200 || response.status >= 300) {
      const detail = extractApiErrorMessage(responseText);
      throw new Error(`Volcengine API Error (${response.status}): ${detail}`);
    }
    return responseText;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  if (!response.ok) {
    const detail = extractApiErrorMessage(responseText);
    throw new Error(`Volcengine API Error (${response.status}): ${detail}`);
  }
  return responseText;
};

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  const origin = window.location?.origin ?? "";
  if (origin === "https://localhost" || origin === "capacitor://localhost" || origin.startsWith("http://localhost")) return true;
  return false;
}

export const analyzeSentence = async (text: string): Promise<AnalysisResult> => {
  const settings = getSettings();
  const apiKey = settings.apiKey?.trim() || "";
  if (!apiKey) {
    throw new Error("API Key is required. Please open Settings and save your API Key.");
  }
  const modelId = settings.modelId?.trim() || DEFAULT_MODEL_ID;

  const inNative = isNativeApp();
  let baseUrl = settings.baseUrl?.trim().replace(/\/$/, "") || (inNative ? VOLCENGINE_API_BASE : "/api/v3");
  if (!inNative && baseUrl.includes("ark.cn-beijing.volces.com")) baseUrl = "/api/v3";

  const pathSuffix = "/chat/completions";
  const endpoint = baseUrl.endsWith(pathSuffix) ? baseUrl : `${baseUrl}${pathSuffix}`;

  const systemPrompt = `You are a professional English oral practice assistant.
Your task is to analyze the user's English sentence for grammar, naturalness, and vocabulary.

Output format: **STRICT JSON ONLY**. Do not output markdown code blocks (like \`\`\`json).

JSON Structure:
{
  "isCorrect": boolean, // True if the original sentence is grammatically correct and natural.
  "correctedSentence": string, // The grammatically correct version.
  "displayHtml": string, // HTML string. If incorrect, wrap the error part in <span class='text-red-500 line-through mr-1'> and the correction in <span class='text-green-600 font-bold'>. If correct, return the sentence as is.
  "translation": string, // Chinese translation of the corrected sentence.
  "examples": [ // 3 similar sentences using the same grammar structure.
    { "en": string, "cn": string }
  ]
}`;

  const body = {
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Analyze this sentence: "${text}"` },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  };

  try {
    console.log(`Sending request to: ${endpoint} with model: ${modelId}`);

    let responseText: string;
    try {
      responseText = await requestChatCompletions(endpoint, apiKey, body, inNative);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const shouldFallbackToDefaultModel =
        modelId !== DEFAULT_MODEL_ID &&
        message.includes("Volcengine API Error (404)");

      if (!shouldFallbackToDefaultModel) {
        throw error;
      }

      const fallbackBody = { ...body, model: DEFAULT_MODEL_ID };
      console.warn(`Model "${modelId}" unavailable, fallback to "${DEFAULT_MODEL_ID}"`);
      responseText = await requestChatCompletions(endpoint, apiKey, fallbackBody, inNative);
    }

    if (responseText.trimStart().startsWith("<")) {
      throw new Error("API returned HTML instead of JSON. Check base URL (use full URL in app settings if on mobile).");
    }

    const data = JSON.parse(responseText) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) throw new Error("No content received from AI service");

    // Attempt to clean up if the model includes markdown formatting despite instructions
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/^```json/, "").replace(/```$/, "");
    } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```/, "").replace(/```$/, "");
    }

    return JSON.parse(jsonStr) as AnalysisResult;

  } catch (error) {
    console.error("AI Service Error:", error);
    throw error;
  }
};
