import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  RotateCw,
  Download,
  AlertCircle,
  RefreshCw,
  Sun,
  Moon,
  Copy,
  Check,
} from 'lucide-react';

// Configure pdfjs worker to use local bundled worker via Vite asset URL
try {
  if (typeof window !== 'undefined' && pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  }
} catch (e) {
  console.warn('PDF.js worker initialization warning:', e);
}

interface PdfCanvasViewerProps {
  url: string;
  fileName?: string;
  textContent?: string;
  onDownload?: () => void;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  url,
  fileName = 'document.pdf',
  textContent,
  onDownload,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [invertColors, setInvertColors] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'canvas' | 'text'>('canvas');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [extractedPdfText, setExtractedPdfText] = useState<string>(textContent || '');

  // Render a specific page
  const renderPage = useCallback(
    async (doc: any, pageNumber: number, targetScale: number, targetRotation: number) => {
      if (!doc || !canvasRef.current) return;

      try {
        setIsRenderingPage(true);
        const page = await doc.getPage(pageNumber);

        const viewport = page.getViewport({ scale: targetScale, rotation: targetRotation });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        // Support high-DPI displays (retina)
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          transform: transform || undefined,
        };

        await page.render(renderContext).promise;
      } catch (err: any) {
        console.error('Lỗi khi vẽ trang PDF lên Canvas:', err);
      } finally {
        setIsRenderingPage(false);
      }
    },
    []
  );

  // Load PDF document
  useEffect(() => {
    let isCancelled = false;
    let loadingTask: any = null;

    const loadPdf = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setCurrentPage(1);

      try {
        loadingTask = pdfjsLib.getDocument({
          url,
          withCredentials: false,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);

        // Attempt client-side text extraction if not already provided
        if (!textContent) {
          try {
            let combinedText = '';
            const maxExtract = Math.min(doc.numPages, 10);
            for (let i = 1; i <= maxExtract; i++) {
              const p = await doc.getPage(i);
              const tc = await p.getTextContent();
              const pageStr = tc.items.map((item: any) => item.str || '').join(' ');
              if (pageStr.trim()) {
                combinedText += `--- Trang ${i} ---\n${pageStr}\n\n`;
              }
            }
            if (combinedText.trim()) {
              setExtractedPdfText(combinedText.trim());
            }
          } catch (e) {
            console.warn('Text extraction fallback notice:', e);
          }
        }

        await renderPage(doc, 1, scale, rotation);
      } catch (err: any) {
        if (isCancelled) return;
        console.warn('Không thể tải PDF qua Canvas:', err);
        setErrorMessage(
          err?.message || 'Không thể hiển thị PDF qua Canvas. Hãy chuyển sang chế độ Xem Văn Bản Trích Xuất hoặc Mở Tab Mới.'
        );
        // If canvas fails, switch smoothly to text mode if text is available
        if (textContent || extractedPdfText) {
          setViewMode('text');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
      if (loadingTask && loadingTask.destroy) {
        loadingTask.destroy();
      }
    };
  }, [url]);

  // Re-render when page, scale, or rotation changes
  useEffect(() => {
    if (pdfDoc && viewMode === 'canvas') {
      renderPage(pdfDoc, currentPage, scale, rotation);
    }
  }, [pdfDoc, currentPage, scale, rotation, viewMode, renderPage]);

  // Navigation handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleFitWidth = () => {
    if (containerRef.current && pdfDoc) {
      const containerWidth = containerRef.current.clientWidth - 48; // padding
      setScale(Math.max(0.6, Math.min(containerWidth / 620, 2.0)));
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleCopyText = () => {
    const textToCopy = extractedPdfText || textContent || '';
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700 dark:border-[#333333] rounded overflow-hidden shadow-lg">
      {/* Top Toolbar */}
      <div className="bg-slate-800 dark:bg-[#181818] border-b border-slate-700 dark:border-[#2C2C2C] px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left: View Mode Toggle & Page Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-slate-950/70 p-0.5 rounded border border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${
                viewMode === 'canvas'
                  ? 'bg-blue-600 text-white dark:bg-[#D4AF37] dark:text-black shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Trang Canvas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('text')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${
                viewMode === 'text'
                  ? 'bg-blue-600 text-white dark:bg-[#D4AF37] dark:text-black shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Văn Bản Trích Xuất</span>
            </button>
          </div>

          {viewMode === 'canvas' && totalPages > 0 && (
            <div className="flex items-center gap-1 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-700 text-white">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1 || isRenderingPage}
                className="p-1 hover:bg-slate-700 disabled:opacity-30 rounded cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1 font-semibold">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages || isRenderingPage}
                className="p-1 hover:bg-slate-700 disabled:opacity-30 rounded cursor-pointer"
                title="Trang sau"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Zoom, Rotate, Invert, Direct Open */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {viewMode === 'canvas' && (
            <>
              <div className="flex items-center bg-slate-950/60 px-1 py-0.5 rounded border border-slate-700 text-white">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={scale <= 0.6}
                  className="p-1 hover:bg-slate-700 disabled:opacity-30 rounded cursor-pointer"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] px-1.5 text-slate-300 font-semibold">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={scale >= 3.0}
                  className="p-1 hover:bg-slate-700 disabled:opacity-30 rounded cursor-pointer"
                  title="Phóng to"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleFitWidth}
                className="px-2 py-1 bg-slate-950/60 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium cursor-pointer"
                title="Vừa chiều rộng khung xem"
              >
                Vừa Khung
              </button>

              <button
                type="button"
                onClick={handleRotate}
                className="p-1.5 bg-slate-950/60 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded cursor-pointer"
                title="Xoay 90 độ"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setInvertColors((prev) => !prev)}
                className={`p-1.5 bg-slate-950/60 hover:bg-slate-700 border border-slate-700 rounded cursor-pointer ${
                  invertColors ? 'text-amber-400 border-amber-500' : 'text-slate-300'
                }`}
                title={invertColors ? 'Màu gốc (Nền trắng)' : 'Chế độ tương phản tối (Dễ đọc ban đêm)'}
              >
                {invertColors ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            </>
          )}

          {viewMode === 'text' && (
            <button
              type="button"
              onClick={handleCopyText}
              className="px-2.5 py-1 bg-slate-950/60 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
            >
              {copiedText ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Sao chép chữ</span>
                </>
              )}
            </button>
          )}

          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 bg-slate-950/60 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded cursor-pointer"
            title="Mở toàn màn hình trong tab mới"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </a>

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="p-1.5 bg-blue-600 hover:bg-blue-700 dark:bg-[#D4AF37] dark:hover:bg-[#bfa035] text-white dark:text-black rounded cursor-pointer font-bold"
              title="Tải tệp PDF về máy"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div
        ref={containerRef}
        className="flex-1 min-h-[380px] max-h-[580px] overflow-auto bg-slate-950 p-4 flex flex-col items-center justify-start relative select-text"
      >
        {isLoading ? (
          <div className="py-24 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-blue-500 dark:text-[#D4AF37]" />
            <p className="text-xs font-medium">Đang tải và chuẩn bị trang PDF Canvas...</p>
            <p className="text-[11px] text-slate-500">
              Công nghệ render HTML5 Canvas trực tiếp (Không dùng iframe để tránh lỗi chặn sandbox trình duyệt)
            </p>
          </div>
        ) : viewMode === 'text' ? (
          /* Text Mode */
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded p-6 shadow-inner text-slate-200 text-xs font-mono whitespace-pre-wrap leading-relaxed">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-[11px] text-slate-400">
              <span className="font-semibold text-white">NỘI DUNG VĂN BẢN TRÍCH XUẤT TỪ PDF</span>
              <span>{extractedPdfText ? `${extractedPdfText.length} ký tự` : 'Chưa có nội dung văn bản'}</span>
            </div>
            {extractedPdfText || textContent ? (
              extractedPdfText || textContent
            ) : (
              <div className="py-10 text-center text-slate-500">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Không tìm thấy văn bản số hóa dạng text trong PDF này (có thể là tệp quét ảnh Scan).</p>
                <p className="text-[11px] mt-1">Hãy chuyển sang tab "Trang Canvas" để xem hình ảnh trang gốc.</p>
              </div>
            )}
          </div>
        ) : errorMessage ? (
          /* Canvas Error Fallback */
          <div className="py-16 text-center max-w-md mx-auto space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-amber-500" />
            <h4 className="font-bold text-white text-sm">Không thể kết xuất trang qua Canvas</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{errorMessage}</p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewMode('text')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs"
              >
                Xem Văn Bản Trích Xuất
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded font-bold text-xs"
              >
                Mở Trong Tab Mới
              </a>
            </div>
          </div>
        ) : (
          /* Canvas Page Renderer */
          <div className="relative flex flex-col items-center shadow-2xl rounded">
            {isRenderingPage && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-10 rounded">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500 dark:text-[#D4AF37]" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              className={`rounded transition-all duration-150 ${
                invertColors
                  ? 'invert hue-rotate-180 brightness-95 contrast-125 shadow-cyan-950/30'
                  : 'bg-white shadow-black/60'
              }`}
            />
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-slate-800/90 dark:bg-[#141414] border-t border-slate-700 dark:border-[#262626] px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate max-w-[280px] font-mono text-slate-300 font-medium">
          {fileName}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-medium">● Native HTML5 Canvas Renderer</span>
          {totalPages > 0 && <span>Tổng cộng: {totalPages} trang</span>}
        </div>
      </div>
    </div>
  );
};
