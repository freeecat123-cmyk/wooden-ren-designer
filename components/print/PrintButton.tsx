"use client";

interface Props {
  /** 若提供，列印前會把 document.title 暫改成這個，讓「存成 PDF」預填有意義的檔名 */
  suggestedFilename?: string;
}

export function PrintButton({ suggestedFilename }: Props) {
  const handleClick = () => {
    if (suggestedFilename) {
      const prev = document.title;
      document.title = suggestedFilename;
      // 給瀏覽器一個 tick 讓 title 生效再開列印對話框
      requestAnimationFrame(() => {
        window.print();
        // 列印對話框關閉（阻塞結束）後還原標題
        setTimeout(() => {
          document.title = prev;
        }, 500);
      });
    } else {
      window.print();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="px-4 py-2 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-700"
    >
      🖨️ 列印 / 存成 PDF
    </button>
  );
}
