import React, { useState, useEffect } from 'react';
import { Task, TaskAnalysisResult, TaskAnalysisStep } from '../types/index.ts';
import {
  Sparkles,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Copy,
  Check,
  FileText,
  MessageSquare,
  RefreshCw,
  Repeat,
  ShieldAlert,
  ArrowRight,
  ListChecks,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../services/api.ts';

interface TaskAiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onSaveAsNote?: (title: string, content: string, tags: string[], linkedTaskId?: string) => Promise<void>;
  onOpenAiChat?: (promptText: string) => void;
}

export const TaskAiAnalysisModal: React.FC<TaskAiAnalysisModalProps> = ({
  isOpen,
  onClose,
  task,
  onSaveAsNote,
  onOpenAiChat,
}) => {
  const [analysis, setAnalysis] = useState<TaskAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<'roadmap' | 'report'>('roadmap');

  useEffect(() => {
    if (isOpen && task) {
      loadAnalysis();
      setCompletedSteps({});
      setNoteSaved(false);
      setActiveTab('roadmap');
    } else {
      setAnalysis(null);
      setError(null);
    }
  }, [isOpen, task?.id]);

  const loadAnalysis = async () => {
    if (!task) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.analyzeTask(task, task.id);
      if (res.success && res.analysis) {
        setAnalysis(res.analysis);
      } else {
        throw new Error('Không nhận được dữ liệu phân tích từ AI.');
      }
    } catch (err: any) {
      console.error('Error loading task analysis:', err);
      setError(err?.message || 'Có lỗi xảy ra khi phân tích công việc bằng AI.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStepCompleted = (stepNumber: number) => {
    setCompletedSteps(prev => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  const handleCopyReport = () => {
    if (!analysis) return;
    const textToCopy = `${analysis.markdownReport}\n\n---\n🎯 Lộ trình thực hiện:\n${analysis.actionPlan.map(s => `${s.step}. ${s.title}: ${s.description} (${s.estimatedMinutes || 15}p)`).join('\n')}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToNote = async () => {
    if (!analysis || !task || !onSaveAsNote || isSavingNote || noteSaved) return;
    setIsSavingNote(true);
    try {
      const noteTitle = `Phân tích AI: ${task.title}`;
      const noteContent = `${analysis.markdownReport}\n\n### 📋 Kế hoạch hành động đề xuất:\n${analysis.actionPlan.map(s => `- [ ] **Bước ${s.step}: ${s.title}** (${s.estimatedMinutes || 15} phút)\n  ${s.description}`).join('\n')}\n\n> ⏱️ **Gợi ý khung giờ thực hiện:** ${analysis.suggestedCompletionWindow}`;
      const tags = ['phan_tich_ai', 'ke_hoach', ...(task.tags || [])];

      await onSaveAsNote(noteTitle, noteContent, tags, task.id);
      setNoteSaved(true);
    } catch (err: any) {
      alert(`Không thể lưu thành ghi chú: ${err?.message}`);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleOpenChat = () => {
    if (!task || !onOpenAiChat) return;
    const prompt = `Tôi cần trao đổi sâu hơn về công việc: "${task.title}". Mô tả: "${task.description}". Hãy cùng tôi lên phương án thực thi chi tiết.`;
    onClose();
    onOpenAiChat(prompt);
  };

  if (!isOpen || !task) return null;

  const getUrgencyBadge = (level: string) => {
    switch (level) {
      case 'critical':
        return {
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          bar: 'bg-rose-500',
          label: 'Khẩn cấp tối đa',
        };
      case 'high':
        return {
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          bar: 'bg-amber-500',
          label: 'Ưu tiên cao',
        };
      case 'medium':
        return {
          bg: 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40',
          bar: 'bg-[#D4AF37]',
          label: 'Mức trung bình',
        };
      default:
        return {
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          bar: 'bg-emerald-500',
          label: 'Bình thường',
        };
    }
  };

  const urgencyMeta = analysis ? getUrgencyBadge(analysis.urgencyEvaluation?.level || 'medium') : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl bg-[#121212] border border-[#2A2A2A] rounded-sm shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#171717] border-b border-[#2A2A2A] flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-xs bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                <span>Phân tích & Đánh giá AI</span>
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-xs border ${
                task.priority === 'high' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                task.priority === 'medium' ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30' :
                'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}>
                {task.priority.toUpperCase()}
              </span>
              {task.recurring && task.recurring.type !== 'none' && (
                <span className="text-[10px] px-2 py-0.5 rounded-xs bg-sky-950/40 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                  <Repeat className="w-3 h-3 text-sky-400" />
                  <span>Định kỳ lặp lại</span>
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-editorial-serif font-bold text-white leading-snug truncate">
              {task.title}
            </h2>
            {task.deadline && (
              <div className="flex items-center gap-2 text-xs text-[#888888]">
                <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Hạn chót: <strong className="text-zinc-200">{new Date(task.deadline).toLocaleString('vi-VN')}</strong></span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm hover:bg-[#2A2A2A] text-[#888888] hover:text-white transition-colors cursor-pointer shrink-0"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading && (
            <div className="py-16 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-[#1A1A1A] border-2 border-[#D4AF37] flex items-center justify-center animate-pulse shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                  <Sparkles className="w-7 h-7 text-[#D4AF37] animate-spin" style={{ animationDuration: '3s' }} />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-editorial-serif font-bold text-white">
                  AI đang tự động phân tích và đánh giá công việc...
                </p>
                <p className="text-xs text-[#888888] max-w-md">
                  Đang đánh giá rủi ro, phân rã checklist hành động và trích xuất các điểm mấu chốt để bạn thực thi ngay.
                </p>
              </div>
            </div>
          )}

          {error && !isLoading && (
            <div className="p-4 rounded-sm bg-rose-950/20 border border-rose-900/60 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="text-sm text-rose-200 font-medium">{error}</p>
              <button
                onClick={loadAnalysis}
                className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#c29f2e] text-black font-bold text-xs uppercase tracking-wider rounded-sm cursor-pointer inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử phân tích lại</span>
              </button>
            </div>
          )}

          {!isLoading && !error && analysis && (
            <>
              {/* Executive Summary Card */}
              <div className="p-4 rounded-sm bg-[#161616] border border-[#2A2A2A] space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tổng quan nhận định</span>
                </div>
                <p className="text-sm text-zinc-200 leading-relaxed font-sans">
                  {analysis.summary}
                </p>
              </div>

              {/* Two-Column Assessment Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Urgency & Risk Card */}
                <div className="p-3.5 rounded-sm bg-[#161616] border border-[#2A2A2A] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#888888] flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      <span>Tính khẩn cấp & Rủi ro</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-xs border ${urgencyMeta?.bg}`}>
                      {analysis.urgencyEvaluation?.label || 'Mức độ ưu tiên'}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-[#222222] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${urgencyMeta?.bar}`}
                      style={{ width: `${analysis.urgencyEvaluation?.score || 65}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#AAAAAA] leading-relaxed">
                    {analysis.urgencyEvaluation?.explanation}
                  </p>
                </div>

                {/* Complexity Card */}
                <div className="p-3.5 rounded-sm bg-[#161616] border border-[#2A2A2A] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#888888] flex items-center gap-1">
                      <ListChecks className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Quy mô & Độ phức tạp</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-[#222222] text-zinc-300 border border-zinc-700">
                      {analysis.complexityEvaluation?.label || 'Độ phức tạp'}
                    </span>
                  </div>
                  <p className="text-xs text-[#AAAAAA] leading-relaxed pt-1.5">
                    {analysis.complexityEvaluation?.explanation}
                  </p>
                </div>
              </div>

              {/* Optimal Completion Window Banner */}
              {analysis.suggestedCompletionWindow && (
                <div className="p-3 rounded-sm bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <span className="font-bold text-[#D4AF37] uppercase tracking-wider block">
                      Khung giờ thực hiện tối ưu:
                    </span>
                    <span className="text-zinc-200">
                      {analysis.suggestedCompletionWindow}
                    </span>
                  </div>
                </div>
              )}

              {/* Key Takeaways */}
              {analysis.keyTakeaways && analysis.keyTakeaways.length > 0 && (
                <div className="p-4 rounded-sm bg-[#161616] border border-[#2A2A2A] space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Điểm then chốt & Chi tiết cần lưu ý</span>
                  </h3>
                  <div className="space-y-1.5">
                    {analysis.keyTakeaways.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-zinc-300 bg-[#0F0F0F] p-2 rounded-xs border border-[#222222]">
                        <span className="text-[#D4AF37] font-bold">•</span>
                        <span className="leading-relaxed flex-1">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabs for Roadmap vs Full Report */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-2">
                  <button
                    onClick={() => setActiveTab('roadmap')}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-colors flex items-center gap-1.5 ${
                      activeTab === 'roadmap'
                        ? 'bg-[#D4AF37] text-black'
                        : 'text-[#888888] hover:text-white bg-[#1A1A1A]'
                    }`}
                  >
                    <ListChecks className="w-3.5 h-3.5" />
                    <span>Lộ trình thực hiện ({analysis.actionPlan?.length || 0} bước)</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('report')}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm cursor-pointer transition-colors flex items-center gap-1.5 ${
                      activeTab === 'report'
                        ? 'bg-[#D4AF37] text-black'
                        : 'text-[#888888] hover:text-white bg-[#1A1A1A]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Báo cáo chi tiết Markdown</span>
                  </button>
                </div>

                {activeTab === 'roadmap' && (
                  <div className="space-y-2.5">
                    {analysis.actionPlan?.map((step) => {
                      const isDone = Boolean(completedSteps[step.step]);
                      return (
                        <div
                          key={step.step}
                          onClick={() => toggleStepCompleted(step.step)}
                          className={`p-3 rounded-sm border transition-all cursor-pointer flex items-start gap-3 select-none ${
                            isDone
                              ? 'bg-[#0E0E0E] border-emerald-900/40 opacity-75'
                              : 'bg-[#161616] border-[#2A2A2A] hover:border-[#383838]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => {}} // handled by parent onClick
                            className="mt-0.5 w-4 h-4 rounded-sm border-[#333333] bg-[#0A0A0A] text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-xs font-bold font-editorial-serif ${
                                isDone ? 'text-zinc-400 line-through' : 'text-white'
                              }`}>
                                Bước {step.step}: {step.title}
                              </span>
                              {step.estimatedMinutes && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-xs bg-[#222222] text-[#888888] font-mono shrink-0">
                                  ⏱️ {step.estimatedMinutes} phút
                                </span>
                              )}
                            </div>
                            <p className={`text-xs leading-relaxed ${
                              isDone ? 'text-zinc-500' : 'text-[#AAAAAA]'
                            }`}>
                              {step.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'report' && (
                  <div className="p-4 rounded-sm bg-[#0E0E0E] border border-[#2A2A2A] font-sans text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                    {analysis.markdownReport}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#171717] border-t border-[#2A2A2A] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              disabled={!analysis || isLoading}
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm bg-[#222222] hover:bg-[#2D2D2D] text-white border border-[#333333] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
            </button>

            {onSaveAsNote && (
              <button
                onClick={handleSaveToNote}
                disabled={!analysis || isLoading || isSavingNote || noteSaved}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm border transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                  noteSaved
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                    : 'bg-[#222222] hover:bg-[#2D2D2D] text-white border-[#333333]'
                }`}
              >
                {noteSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Đã lưu vào Ghi chú</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>{isSavingNote ? 'Đang lưu...' : 'Lưu thành Ghi chú'}</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={loadAnalysis}
              disabled={isLoading}
              className="p-1.5 text-zinc-400 hover:text-white rounded-sm hover:bg-[#2A2A2A] transition-colors cursor-pointer"
              title="Phân tích lại"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onOpenAiChat && (
              <button
                onClick={handleOpenChat}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#D4AF37] border border-[#D4AF37]/30 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Trao đổi sâu với AI</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm bg-[#D4AF37] hover:bg-[#c29f2e] text-black transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
