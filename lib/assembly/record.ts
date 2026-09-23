/**
 * 把 3D canvas 錄成影片（組裝動畫輸出用）。
 *
 * 走瀏覽器內建的 `canvas.captureStream()` + `MediaRecorder`，不用伺服器：
 * - Chrome / Edge / Firefox → WebM（VP9 優先；Pinterest 不收 WebM 的話用 Safari 錄或轉檔）
 * - Safari 14.1+ → MP4（H.264）
 * 拿到的 Blob 直接觸發下載。
 *
 * ⚠️ 只有畫面真的在重繪時 captureStream 才有新幀。組裝動畫播放期間
 *    frameloop 是連續的（AssemblyDriver 每幀 invalidate），所以夠；
 *    靜止畫面錄出來會是定格。
 */

/**
 * 順序：WebM 優先、MP4 墊後。
 * Chrome 的 MediaRecorder 雖然也能出 MP4(avc1)，但 2026-09-02 實測（headless 真 Chrome）
 * 出來的 H.264 串流 ffmpeg 解碼滿滿錯誤；VP9 WebM 乾淨。Safari 不會錄 WebM → 自然落到 MP4，
 * 而 Safari 的 MP4 解碼零錯誤。
 */
const CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4;codecs=avc1",
  "video/mp4",
];

/** 這個瀏覽器能錄的第一個格式；都不行回 null（例如舊版 iOS Safari）。 */
export function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* 某些瀏覽器對不認識的字串會 throw，當不支援 */
    }
  }
  return null;
}

export function extensionForMime(mime: string): "mp4" | "webm" {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
}

export interface CanvasRecording {
  mime: string;
  /** 停止錄影並取回影片。 */
  stop: () => Promise<Blob>;
}

/**
 * 開始錄 canvas。回傳的 stop() 才會把 Blob 交出來。
 * 錄到一半 canvas 被移除 / 尺寸改變都不會壞，只是那段畫面照錄。
 */
export function startCanvasRecording(canvas: HTMLCanvasElement, fps = 30): CanvasRecording {
  const mime = pickRecorderMime();
  if (!mime) throw new Error("recorder-unsupported");
  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => {
      for (const t of stream.getTracks()) t.stop();
      resolve(new Blob(chunks, { type: mime }));
    };
  });
  // 每 250ms 吐一段，避免最後一段太大或 stop 時漏幀
  rec.start(250);
  return {
    mime,
    stop: () => {
      if (rec.state !== "inactive") rec.stop();
      return done;
    },
  };
}

/** 觸發瀏覽器下載。檔名裡的斜線等會被瀏覽器自己清掉，這裡只擋 `/`。 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\//g, "-");
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 給瀏覽器一點時間接手，太早 revoke 在 Safari 會下載到空檔
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
