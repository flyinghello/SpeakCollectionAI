import { Capacitor } from "@capacitor/core";
import { getSettings } from "./storageService";
import { getCachedAudio, cacheAudio } from "./dbService";

const TTS_HTTP_URL = "/tts-api/api/v3/tts/unidirectional/sse";
const DEFAULT_TTS_VOICE = "zh_female_vv_mars_bigtts";

let activeAudio: HTMLAudioElement | null = null;
let activeUrl: string | null = null;

const stopActiveAudio = () => {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (activeUrl) {
    URL.revokeObjectURL(activeUrl);
    activeUrl = null;
  }
};

export const speakSentence = async (text: string): Promise<void> => {
  const sentence = text.trim();
  if (!sentence) return;

  const settings = getSettings();
  const appId = settings.ttsAppId?.trim() || "";
  const accessToken = settings.ttsAccessToken?.trim() || "";

  if (!appId || !accessToken) {
    throw new Error("TTS App ID and Access Token are required. Please open Settings and save your TTS credentials.");
  }

  const voice = settings.ttsModel?.trim() || DEFAULT_TTS_VOICE;

  // Check cache first
  const cachedBlob = await getCachedAudio(sentence, voice);
  if (cachedBlob) {
    console.log("Using cached audio for:", sentence);
    await playBlob(cachedBlob);
    return;
  }

  if (typeof window !== "undefined" && window.location?.protocol === "file:") {
    throw new Error(
      "Web TTS cannot run from file:// due to browser CORS restrictions. Start the app via `npm run dev` (recommended) or host it over HTTP(S) with a backend proxy.",
    );
  }

  const requestBody = {
    req_params: {
      text: sentence,
      speaker: voice,
      audio_params: {
        format: "mp3",
        sample_rate: 24000,
      },
    },
  };

  try {
    const response = await fetch(TTS_HTTP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-App-Id": appId,
        "X-Api-Access-Key": accessToken,
        "X-Api-Resource-Id": "seed-tts-1.0",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS API Error (${response.status}): ${errorText.slice(0, 500)}`);
    }

    const responseText = await response.text();
    console.log("TTS Raw Response length:", responseText.length);

    const audioChunks: Uint8Array[] = [];
    const lines = responseText.split("\n");

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine === "[DONE]") continue;

      let dataStr = "";
      if (trimmedLine.startsWith("data:")) {
        dataStr = trimmedLine.slice(5).trim();
      } else if (trimmedLine.startsWith("{")) {
        dataStr = trimmedLine;
      }

      if (dataStr) {
        try {
          const data = JSON.parse(dataStr);
          
          if (data.code && data.code !== 0 && data.code !== 20000000) {
            console.error("TTS API Error in data:", data);
            continue;
          }

          let base64 = "";
          if (data.data) {
            if (typeof data.data === "string") {
              base64 = data.data;
            } else if (data.data.audio) {
              base64 = data.data.audio;
            } else if (data.data.binary) {
              base64 = data.data.binary;
            }
          }

          if (base64) {
            const binaryStr = atob(base64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            audioChunks.push(bytes);
          }
        } catch (e) {
          // Not a valid JSON or other error, skip
        }
      }
    }

    if (audioChunks.length === 0) {
      throw new Error("No audio data received from TTS service.");
    }

    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const audioBlob = new Blob([combined], { type: "audio/mpeg" });

    if (audioBlob.size === 0) {
      throw new Error("Empty audio returned from TTS service.");
    }

    console.log("Combined audio blob size:", audioBlob.size);
    
    // Save to cache
    await cacheAudio(sentence, voice, audioBlob);

    await playBlob(audioBlob);

  } catch (error) {
    stopActiveAudio();
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`TTS failed: ${detail}`);
  }
};

const playBlob = async (blob: Blob): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    try {
      stopActiveAudio();
      activeUrl = URL.createObjectURL(blob);
      const audio = new Audio(activeUrl);
      activeAudio = audio;

      audio.onended = () => {
        // We don't revoke immediately to avoid issues with rapid clicks
        // stopActiveAudio will handle it on next play
        resolve();
      };

      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        stopActiveAudio();
        reject(new Error("Audio playback failed."));
      };

      audio.play().catch((e) => {
        console.error("Audio play promise rejected:", e);
        stopActiveAudio();
        reject(e);
      });
    } catch (e) {
      reject(e);
    }
  });
};
