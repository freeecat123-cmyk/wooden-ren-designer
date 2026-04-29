"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Mode = "browser" | "whisper";
type Status = "idle" | "recording" | "processing" | "error";

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const LANGUAGES: Array<{ code: string; label: string; whisperCode: string }> = [
  { code: "zh-TW", label: "中文（繁體）", whisperCode: "zh" },
  { code: "zh-CN", label: "中文（簡體）", whisperCode: "zh" },
  { code: "en-US", label: "English", whisperCode: "en" },
  { code: "ja-JP", label: "日本語", whisperCode: "ja" },
];

export default function VoicePage() {
  const [mode, setMode] = useState<Mode>("browser");
  const [language, setLanguage] = useState("zh-TW");
  const [cleanup, setCleanup] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [browserSupported, setBrowserSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // 偵測瀏覽器是否支援 SpeechRecognition
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const supported = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    setBrowserSupported(supported);
    if (!supported) setMode("whisper");
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // iOS Safari 在某些情境會擋；fallback 給使用者手動複製
    }
  }, []);

  const startBrowserRecognition = useCallback(() => {
    setError("");
    setTranscript("");
    setInterim("");

    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setError("此瀏覽器不支援語音辨識，請改用 Whisper 模式");
      setStatus("error");
      return;
    }

    const recog = new SR();
    recog.lang = language;
    recog.continuous = true;
    recog.interimResults = true;

    let finalText = "";

    recog.onresult = (e) => {
      let interimChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimChunk += r[0].transcript;
      }
      setTranscript(finalText);
      setInterim(interimChunk);
    };
    recog.onerror = (e) => {
      // 'no-speech' 和 'aborted' 不算錯，靜默處理
      if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(`辨識錯誤: ${e.error}`);
        setStatus("error");
      }
    };
    recog.onend = () => {
      setInterim("");
      setStatus((prev) => (prev === "recording" ? "idle" : prev));
      if (finalText.trim()) copyToClipboard(finalText);
    };

    recognitionRef.current = recog;
    recog.start();
    setStatus("recording");
  }, [language, copyToClipboard]);

  const stopBrowserRecognition = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startWhisperRecording = useCallback(async () => {
    setError("");
    setTranscript("");
    setInterim("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) {
          setStatus("idle");
          return;
        }

        setStatus("processing");
        const fd = new FormData();
        fd.append("audio", blob, "recording.webm");
        fd.append("cleanup", String(cleanup));
        fd.append(
          "language",
          LANGUAGES.find((l) => l.code === language)?.whisperCode ?? "zh",
        );

        try {
          const res = await fetch("/api/voice/transcribe", {
            method: "POST",
            body: fd,
          });
          const data = (await res.json()) as {
            text?: string;
            error?: string;
            cleanupError?: string;
          };
          if (!res.ok) {
            setError(data.error || `HTTP ${res.status}`);
            setStatus("error");
            return;
          }
          const text = (data.text || "").trim();
          setTranscript(text);
          if (data.cleanupError) {
            setError(`清理失敗（顯示原始辨識）：${data.cleanupError}`);
          }
          if (text) copyToClipboard(text);
          setStatus("idle");
        } catch (err) {
          setError(err instanceof Error ? err.message : "上傳失敗");
          setStatus("error");
        }
      };

      mr.start();
      setStatus("recording");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "無法取得麥克風";
      setError(`${msg}（請允許麥克風權限）`);
      setStatus("error");
    }
  }, [cleanup, language, copyToClipboard]);

  const stopWhisperRecording = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const handleRecordToggle = () => {
    if (status === "recording") {
      if (mode === "browser") stopBrowserRecognition();
      else stopWhisperRecording();
    } else if (status === "idle" || status === "error") {
      if (mode === "browser") startBrowserRecognition();
      else startWhisperRecording();
    }
  };

  // 卸載時清理
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const isRecording = status === "recording";
  const isProcessing = status === "processing";
  const buttonLabel =
    isRecording ? "停止錄音"
    : isProcessing ? "辨識中…"
    : "點一下開始錄音";
  const statusHint =
    isRecording
      ? mode === "browser"
        ? "說話中…（即時辨識）"
        : "錄音中…再按一次停止上傳"
      : isProcessing
      ? "上傳到 Whisper 並用 Claude 清理中…"
      : transcript
      ? "辨識完成，已自動複製到剪貼簿"
      : "麥克風會在你按下後啟動";

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-5 py-8">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 ring-1 ring-violet-200 text-violet-800 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          語音輸入助手 · MVP
        </div>
        <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
          說一段話，自動轉文字並複製
        </h1>
        <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
          按下大按鈕開始錄音，再按一次停止。辨識完的文字會自動複製到剪貼簿，貼到任何聊天視窗即可。
        </p>
      </header>

      {/* 模式切換 */}
      <section className="mb-6 grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-xl text-sm">
        <button
          type="button"
          disabled={!browserSupported || isRecording || isProcessing}
          onClick={() => setMode("browser")}
          className={`px-3 py-2 rounded-lg transition disabled:opacity-40 ${
            mode === "browser"
              ? "bg-white text-zinc-900 shadow-sm font-medium"
              : "text-zinc-600"
          }`}
        >
          🆓 瀏覽器內建
          <span className="block text-[10px] text-zinc-500 font-normal">
            免費 · 即時 · 咬字清楚適用
          </span>
        </button>
        <button
          type="button"
          disabled={isRecording || isProcessing}
          onClick={() => setMode("whisper")}
          className={`px-3 py-2 rounded-lg transition disabled:opacity-40 ${
            mode === "whisper"
              ? "bg-white text-zinc-900 shadow-sm font-medium"
              : "text-zinc-600"
          }`}
        >
          ✨ Whisper + Claude
          <span className="block text-[10px] text-zinc-500 font-normal">
            付費 · 較準 · 含糊咬字也行
          </span>
        </button>
      </section>

      {/* 錄音按鈕 */}
      <section className="flex flex-col items-center justify-center py-8">
        <button
          type="button"
          onClick={handleRecordToggle}
          disabled={isProcessing}
          aria-label={buttonLabel}
          className={`relative w-44 h-44 sm:w-52 sm:h-52 rounded-full flex items-center justify-center text-white text-base font-semibold transition-all select-none touch-manipulation ${
            isRecording
              ? "bg-rose-500 shadow-[0_0_0_12px_rgba(244,63,94,0.15)] scale-105"
              : isProcessing
              ? "bg-zinc-400 cursor-wait"
              : "bg-violet-600 hover:bg-violet-700 active:scale-95 shadow-lg"
          }`}
        >
          {isRecording && (
            <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-30" />
          )}
          <span className="relative flex flex-col items-center gap-1">
            <span className="text-3xl">
              {isRecording ? "⏹" : isProcessing ? "⏳" : "🎙️"}
            </span>
            <span>{buttonLabel}</span>
          </span>
        </button>

        <p className="mt-4 text-sm text-zinc-600 text-center">{statusHint}</p>

        {copied && (
          <p className="mt-2 text-sm text-emerald-700 font-medium">
            ✓ 已複製到剪貼簿
          </p>
        )}

        {error && (
          <p className="mt-3 max-w-md text-sm text-rose-700 bg-rose-50 px-3 py-2 rounded-lg ring-1 ring-rose-200">
            {error}
          </p>
        )}
      </section>

      {/* 辨識結果 */}
      <section className="mb-6">
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">
          辨識結果（可手動修改後再複製）
        </label>
        <textarea
          value={transcript + (interim ? `　${interim}` : "")}
          onChange={(e) => {
            setTranscript(e.target.value);
            setInterim("");
          }}
          placeholder={isRecording ? "辨識中…" : "錄音後辨識的文字會出現在這裡"}
          rows={6}
          className="w-full p-3 text-base rounded-lg border border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 resize-y"
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => copyToClipboard(transcript)}
            disabled={!transcript}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            📋 複製
          </button>
          <button
            type="button"
            onClick={() => {
              setTranscript("");
              setInterim("");
              setError("");
            }}
            disabled={!transcript && !error}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-40 transition"
          >
            清除
          </button>
        </div>
      </section>

      {/* 設定 */}
      <details className="mb-8 text-sm">
        <summary className="cursor-pointer text-zinc-600 hover:text-zinc-900 select-none">
          ⚙️ 設定
        </summary>
        <div className="mt-3 p-4 bg-zinc-50 rounded-lg space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              語言
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={isRecording || isProcessing}
              className="w-full p-2 text-sm rounded-lg border border-zinc-200 bg-white"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {mode === "whisper" && (
            <label className="flex items-start gap-2 text-xs text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={cleanup}
                onChange={(e) => setCleanup(e.target.checked)}
                disabled={isRecording || isProcessing}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">用 Claude 清理</span>
                <span className="block text-zinc-500 leading-relaxed">
                  自動移除「呃、嗯、那個」這類贅字、處理自我修正、修正同音錯字。
                  伺服器需設定 <code>ANTHROPIC_API_KEY</code>。
                </span>
              </span>
            </label>
          )}

          {!browserSupported && (
            <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded ring-1 ring-amber-200">
              此瀏覽器不支援即時語音辨識，已自動切到 Whisper 模式
            </p>
          )}
        </div>
      </details>

      <footer className="mt-12 pt-6 border-t border-zinc-200 text-xs text-zinc-500 space-y-1">
        <p>
          🆓 瀏覽器模式不需要任何 API key，但對含糊咬字較不耐受。
        </p>
        <p>
          ✨ Whisper 模式約 NT$0.2/分鐘，加 Claude 清理另計（每次清理 NT$1 以內）。
        </p>
        <p>
          需在 Vercel 設定 <code>OPENAI_API_KEY</code>（Whisper）和 <code>ANTHROPIC_API_KEY</code>（清理）。
        </p>
      </footer>
    </main>
  );
}
