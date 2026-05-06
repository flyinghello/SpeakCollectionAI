import { getSettings } from "./storageService";

const VOLCENGINE_API_BASE = "https://ark.cn-beijing.volces.com/api/v3";
const DEFAULT_ASR_MODEL = "bigmodel";
const FALLBACK_ASR_MODEL = "doubao-seed-2-0-mini-260428";

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const encodeAudioBufferToWav = (audioBuffer: AudioBuffer): Uint8Array => {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = audioBuffer.getChannelData(ch)[i] ?? 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += bytesPerSample;
    }
  }

  return new Uint8Array(buffer);
};

const convertBlobToAsrPayload = async (audioBlob: Blob): Promise<{ base64Audio: string; format: string }> => {
  const rawBuffer = await audioBlob.arrayBuffer();

  // Try to convert browser-recorded audio (often webm/opus) to valid WAV PCM.
  try {
    const AudioContextCtor =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextCtor) {
      const audioContext = new AudioContextCtor();
      const decoded = await audioContext.decodeAudioData(rawBuffer.slice(0));
      const wavBytes = encodeAudioBufferToWav(decoded);
      await audioContext.close();
      return { base64Audio: toBase64(wavBytes), format: "wav" };
    }
  } catch {
    // Fall back to original bytes with detected format if conversion is unavailable.
  }

  const mime = audioBlob.type.toLowerCase();
  const format = mime.includes("mp3")
    ? "mp3"
    : mime.includes("wav")
      ? "wav"
      : mime.includes("webm")
        ? "webm"
        : "wav";
  return { base64Audio: toBase64(new Uint8Array(rawBuffer)), format };
};

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  const origin = window.location?.origin ?? "";
  if (origin === "https://localhost" || origin === "capacitor://localhost" || origin.startsWith("http://localhost")) return true;
  return false;
}

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const settings = getSettings();
  const apiKey = settings.apiKey?.trim() || "";
  if (!apiKey) {
    throw new Error("API Key is required. Please open Settings and save your API Key.");
  }

  const preferredModel = settings.asrModel?.trim() || DEFAULT_ASR_MODEL;
  const inNative = isNativeApp();
  let asrBaseUrl = settings.asrBaseUrl?.trim() || (inNative ? VOLCENGINE_API_BASE : "/api/v3");
  if (!inNative && asrBaseUrl.includes("ark.cn-beijing.volces.com")) asrBaseUrl = "/api/v3";
  const endpoint = `${asrBaseUrl.replace(/\/$/, "")}/chat/completions`;

  const { base64Audio, format } = await convertBlobToAsrPayload(audioBlob);

  const tryTranscribe = async (model: string) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "You are an ASR engine. Output plain transcription text only.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe the audio into English text only." },
              { type: "input_audio", input_audio: { data: base64Audio, format } },
            ],
          },
        ],
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`ASR API Error (${response.status}): ${responseText.slice(0, 300)}`);
    }

    const data = JSON.parse(responseText) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("No transcription text returned from ASR service.");
    }
    return text;
  };

  try {
    return await tryTranscribe(preferredModel);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldFallback =
      preferredModel === DEFAULT_ASR_MODEL &&
      (message.includes("InvalidEndpointOrModel.NotFound") || message.includes("404"));
    if (!shouldFallback) throw error;
    return await tryTranscribe(FALLBACK_ASR_MODEL);
  }
};
