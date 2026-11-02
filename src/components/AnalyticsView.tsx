import React, { useState, useMemo } from 'react';
import { useTaskStore } from '../stores/useTaskStore.js';
import { useNoteStore } from '../stores/useNoteStore.js';
import { useFileStore } from '../stores/useFileStore.js';
import { useSystemStore } from '../stores/useSystemStore.js';
import {
  TrendingUp,
  Brain,
  CheckCircle2,
  BookOpen,
  Calendar,
  Download,
  RotateCw,
  Target,
  Sparkles,
  BarChart3,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Clock,
  ChevronRight
} from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const tasks = useTaskStore(s => s.tasks);
  const notes = useNoteStore(s => s.notes);
  const files = useFileStore(s => s.files);
  const openAiDrawer = useSystemStore(s => s.openAiDrawer);
  const setActiveTab = useSystemStore(s => s.setActiveTab);

  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d' | '8w'>('30d');
  const [chartMode, setChartMode] = useState<'area' | 'bar'>('area');
  const [showMovingAvg, setShowMovingAvg] = useState(true);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(6); // Default highlight on peak

  // Dynamic real calculations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'completed' || t.status === 'canceled' || !t.deadline) return false;
    return new Date(t.deadline).getTime() < Date.now();
  }).length;
  const onTimeRate = totalTasks > 0 ? Math.max(0, Math.round(((totalTasks - overdueTasks) / totalTasks) * 100)) : 100;

  const notesRatio = totalTasks > 0 ? Math.min(100, Math.round((notes.length / totalTasks) * 100)) : 83;

  // Eisenhower quadrant classification logic
  const getTaskQuadrant = (task: (typeof tasks)[0]): 'Q1' | 'Q2' | 'Q3' | 'Q4' => {
    const deadlineDate = new Date(task.deadline);
    const diffHours = isNaN(deadlineDate.getTime()) ? 999 : (deadlineDate.getTime() - Date.now()) / (1000 * 3600);
    const isUrgent = diffHours <= 48 || (task.tags && task.tags.some(t => t.toLowerCase().includes('khẩn')));
    const isImportant = task.priority === 'high' || task.priority === 'medium';

    if (isUrgent && isImportant) return 'Q1';
    if (!isUrgent && isImportant) return 'Q2';
    if (isUrgent && !isImportant) return 'Q3';
    return 'Q4';
  };

  const q1Count = tasks.filter(t => getTaskQuadrant(t) === 'Q1').length;
  const q2Count = tasks.filter(t => getTaskQuadrant(t) === 'Q2').length;
  const q3Count = tasks.filter(t => getTaskQuadrant(t) === 'Q3').length;
  const q4Count = tasks.filter(t => getTaskQuadrant(t) === 'Q4').length;

  const q2Percent = totalTasks > 0 ? Math.round((q2Count / totalTasks) * 100) : 60;

  // Monthly 30-day Trend simulated realistic data points
  const trendPoints = [
    { day: '1/10', score: 68, focus: 3.2 },
    { day: '4/10', score: 72, focus: 3.5 },
    { day: '7/10', score: 65, focus: 2.8 },
    { day: '10/10', score: 70, focus: 3.4 },
    { day: '13/10', score: 74, focus: 3.8 },
    { day: '16/10', score: 71, focus: 3.2 },
    { day: '19/10', score: 76, focus: 4.0 },
    { day: '22/10', score: 78, focus: 3.9 },
    { day: '25/10', score: 82, focus: 4.2, isPeak: true, task: 'Hoàn thành báo cáo & liều kế' },
    { day: '28/10', score: 75, focus: 3.6 },
    { day: '30/10', score: 77, focus: 3.7 },
  ];

  // Weekly dual axis performance
  const weekDays = [
    { label: 'T7 24/10', completion: 100, focus: 2.0 },
    { label: 'CN 25/10', completion: 100, focus: 4.2, highlight: true },
    { label: 'T2 26/10', completion: 75, focus: 4.0 },
    { label: 'T3 27/10', completion: 75, focus: 3.8 },
    { label: 'T4 28/10', completion: 75, focus: 4.1 },
    { label: 'T5 29/10', completion: 75, focus: 3.5 },
    { label: 'T6 30/10', completion: 75, focus: 3.6 },
  ];

  return (
    <div className="w-full pb-16 animate-fadeIn">
      {/* Sub-navigation Breadcrumb & Control Bar */}
      <div className="w-full bg-white dark:bg-[#141414] rounded-xl p-4 sm:p-5 shadow-xs border border-slate-200 dark:border-[#2A2A2A] mb-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-[#D4AF37] uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-[#D4AF37] animate-pulse"></span>
              <span>HIỆU SUẤT & PHÂN TÍCH HỆ THỐNG</span>
              <span className="text-slate-300 dark:text-[#444]">•</span>
              <span className="text-slate-500 dark:text-[#888]">BÁO CÁO CHUYÊN SÂU RECHARTS ENGINE</span>
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Thống kê & Phân tích Năng suất
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-[#222] dark:text-[#D4AF37] text-xs font-medium">
                Chu kỳ 30 ngày • Tự động tính toán
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#999] max-w-3xl leading-relaxed">
              Theo dõi trực quan quỹ đạo điểm năng suất (0-100), đối chiếu giờ Focus AI và nhịp điệu hoàn thành nhiệm vụ theo ma trận Eisenhower.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Pills */}
            <div className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-[#1E1E1E]">
              {(['7d', '14d', '30d', '8w'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    dateRange === range
                      ? 'bg-white dark:bg-[#2A2A2A] text-blue-600 dark:text-[#D4AF37] shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-[#888] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {range === '7d' ? '7 Ngày' : range === '14d' ? '14 Ngày' : range === '30d' ? '30 Ngày' : '8 Tuần'}
                </button>
              ))}
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#1E1E1E] text-slate-700 dark:text-[#BBB] text-xs">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-[#D4AF37]" />
              <span>01/10/2026 - 30/10/2026</span>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  window.print();
                }}
                className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1E1E1E] dark:hover:bg-[#2A2A2A] text-slate-700 dark:text-[#DDD] text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Xuất báo cáo"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Xuất PDF</span>
              </button>
              <button
                onClick={() => {
                  openAiDrawer('Hãy phân tích toàn diện hiệu suất làm việc 30 ngày qua của tôi và đưa ra 3 lời khuyên cải thiện cụ thể.');
                }}
                className="h-8 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 dark:bg-[#D4AF37] dark:text-black dark:hover:bg-[#c29f2e] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Đánh Giá</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* KPI 1 */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151515] shadow-xs hover:shadow-md transition-shadow border border-slate-200 dark:border-[#2A2A2A] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 dark:bg-[#D4AF37]"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider">
              ĐIỂM TB 30 NGÀY
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-[#202020] text-blue-600 dark:text-[#D4AF37] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">74</span>
            <span className="text-sm text-slate-500 dark:text-[#777]">/ 100</span>
            <span className="ml-auto inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 text-xs font-semibold">
              <TrendingUp className="w-3 h-3" /> +4.2đ
            </span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-[#222] flex items-center justify-between text-xs text-slate-500 dark:text-[#777]">
            <span className="flex items-center gap-1 text-blue-600 dark:text-[#D4AF37] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-[#D4AF37]"></span> Ổn định mức tích cực
            </span>
            <span>Chuẩn ≥ 70</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151515] shadow-xs hover:shadow-md transition-shadow border border-slate-200 dark:border-[#2A2A2A] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600 dark:bg-indigo-400"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider">
              TỔNG GIỜ FOCUS AI
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-[#202020] text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">24.9h</span>
            <span className="text-xs text-slate-500 dark:text-[#777]">TB 3.6h/ngày</span>
            <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 text-xs font-semibold">
              88% Tuần
            </span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-[#222] flex items-center justify-between text-xs text-slate-500 dark:text-[#777]">
            <span>Đỉnh nhịp điệu: CN 25/10</span>
            <span className="font-semibold text-slate-900 dark:text-white">4.2h sâu</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151515] shadow-xs hover:shadow-md transition-shadow border border-slate-200 dark:border-[#2A2A2A] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 dark:bg-emerald-400"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider">
              TỶ LỆ ĐÚNG HẠN (ON-TIME)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-[#202020] text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{onTimeRate}%</span>
            <span className="text-xs text-slate-500 dark:text-[#777]">{overdueTasks} trễ hạn</span>
            <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-semibold">
              Tối ưu
            </span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-[#222] flex items-center justify-between text-xs text-slate-500 dark:text-[#777]">
            <span>Tiến độ thực thi</span>
            <span className="font-semibold text-slate-900 dark:text-white">{completedTasks}/{totalTasks} mốc</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#151515] shadow-xs hover:shadow-md transition-shadow border border-slate-200 dark:border-[#2A2A2A] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 dark:bg-[#D4AF37]"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-[#888] uppercase tracking-wider">
              TỶ LỆ ĐÚC KẾT TRI THỨC
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-[#202020] text-amber-600 dark:text-[#D4AF37] flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{notesRatio}%</span>
            <span className="text-xs text-slate-500 dark:text-[#777]">{notes.length} ghi chú / {totalTasks} task</span>
            <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-xs font-semibold">
              RAG Vector
            </span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-[#222] flex items-center justify-between text-xs text-slate-500 dark:text-[#777]">
            <span className="truncate">Gợi ý AI: Bổ sung Task Q2</span>
            <button
              onClick={() => setActiveTab('notes')}
              className="text-blue-600 dark:text-[#D4AF37] font-semibold hover:underline"
            >
              + Note
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: 8 Cols Charts Workspace + 4 Cols Operations Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Operational Quadrant (8 Columns) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {/* Chart Card 1: 30-Day Monthly Trend */}
          <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#151515] shadow-xs border border-slate-200 dark:border-[#2A2A2A] flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-[#202020] text-blue-600 dark:text-[#D4AF37] flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      Xu Hướng Tháng & Điểm Năng Suất (30 Ngày)
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 dark:bg-[#222] dark:text-[#D4AF37]">
                      MONTHLY TREND
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#888]">
                    Theo dõi quỹ đạo điểm năng suất (0 - 100) liên tục trong 30 ngày qua kết hợp ngưỡng cảnh báo AI
                  </p>
                </div>
              </div>

              {/* Chart Switchers */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-[#1E1E1E]">
                  <button
                    onClick={() => setChartMode('area')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
                      chartMode === 'area'
                        ? 'bg-white dark:bg-[#2A2A2A] text-blue-600 dark:text-[#D4AF37] shadow-xs'
                        : 'text-slate-600 dark:text-[#888]'
                    }`}
                  >
                    Diện tích
                  </button>
                  <button
                    onClick={() => setChartMode('bar')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-colors ${
                      chartMode === 'bar'
                        ? 'bg-white dark:bg-[#2A2A2A] text-blue-600 dark:text-[#D4AF37] shadow-xs'
                        : 'text-slate-600 dark:text-[#888]'
                    }`}
                  >
                    Cột
                  </button>
                </div>
                <button
                  onClick={() => setShowMovingAvg(!showMovingAvg)}
                  className={`h-7 px-2.5 rounded text-xs flex items-center gap-1 transition-colors ${
                    showMovingAvg
                      ? 'bg-blue-50 text-blue-700 dark:bg-[#2A2A2A] dark:text-[#D4AF37] font-semibold'
                      : 'bg-slate-100 text-slate-500 dark:bg-[#1E1E1E] dark:text-[#666]'
                  }`}
                >
                  <span className="w-2 h-0.5 bg-blue-500 rounded-full"></span>
                  <span>TB động 7D</span>
                </button>
              </div>
            </div>

            {/* SVG Visual Chart Recharts Clone */}
            <div className="relative w-full h-72 bg-slate-50/50 dark:bg-[#111111] rounded-xl p-3 select-none overflow-hidden border border-slate-100 dark:border-[#222]">
              <svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 800 240">
                <defs>
                  <linearGradient id="areaGradientBlue" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.32" />
                    <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="lineStrokeBlue" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#004ac6" />
                    <stop offset="70%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid Lines */}
                <line x1="45" x2="780" y1="20" y2="20" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" className="dark:stroke-[#262626]" />
                <line x1="45" x2="780" y1="70" y2="70" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" className="dark:stroke-[#262626]" />
                <line x1="45" x2="780" y1="120" y2="120" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" className="dark:stroke-[#262626]" />
                <line x1="45" x2="780" y1="170" y2="170" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" className="dark:stroke-[#262626]" />
                <line x1="45" x2="780" y1="210" y2="210" stroke="#CBD5E1" strokeWidth="1.5" className="dark:stroke-[#333]" />

                {/* Reference Threshold: Muc tieu 80 (Cyan dashed) */}
                <line x1="45" x2="780" y1="60" y2="60" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="4 4" />
                <text x="50" y="54" fill="#0284c7" fontSize="10" fontWeight="600" fontFamily="Inter">Mục tiêu 80</text>

                {/* Reference Threshold: Nguong 60 (Amber dashed) */}
                <line x1="45" x2="780" y1="100" y2="100" stroke="#d97706" strokeWidth="1.5" strokeDasharray="3 3" />
                <text x="50" y="95" fill="#d97706" fontSize="10" fontWeight="600" fontFamily="Inter">Ngưỡng 60</text>

                {/* Y-Axis Ticks */}
                <text x="35" y="24" textAnchor="end" fill="#94A3B8" fontSize="10" fontFamily="Inter">100đ</text>
                <text x="35" y="74" textAnchor="end" fill="#94A3B8" fontSize="10" fontFamily="Inter">75đ</text>
                <text x="35" y="124" textAnchor="end" fill="#94A3B8" fontSize="10" fontFamily="Inter">50đ</text>
                <text x="35" y="174" textAnchor="end" fill="#94A3B8" fontSize="10" fontFamily="Inter">25đ</text>
                <text x="35" y="214" textAnchor="end" fill="#94A3B8" fontSize="10" fontFamily="Inter">0đ</text>

                {/* 7-day Moving Average Soft Blue Line */}
                {showMovingAvg && (
                  <path
                    d="M 50 72 Q 130 68 210 70 T 370 65 T 530 62 T 690 58 T 775 60"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                  />
                )}

                {/* Actual Productivity Area Polygon */}
                {chartMode === 'area' ? (
                  <>
                    <path
                      d="M 50 70 C 80 50, 110 52, 135 68 C 160 84, 190 60, 220 58 C 255 56, 285 75, 320 74 C 350 73, 385 46, 420 50 C 450 54, 480 75, 510 74 C 540 73, 570 64, 600 66 C 630 68, 660 38, 690 42 C 720 46, 750 82, 780 62 L 780 210 L 50 210 Z"
                      fill="url(#areaGradientBlue)"
                    />
                    <path
                      d="M 50 70 C 80 50, 110 52, 135 68 C 160 84, 190 60, 220 58 C 255 56, 285 75, 320 74 C 350 73, 385 46, 420 50 C 450 54, 480 75, 510 74 C 540 73, 570 64, 600 66 C 630 68, 660 38, 690 42 C 720 46, 750 82, 780 62"
                      fill="none"
                      stroke="url(#lineStrokeBlue)"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />
                  </>
                ) : (
                  // Bar chart mode
                  trendPoints.map((p, idx) => {
                    const x = 50 + idx * 70;
                    const height = (p.score / 100) * 180;
                    const y = 210 - height;
                    return (
                      <rect
                        key={idx}
                        x={x - 14}
                        y={y}
                        width="28"
                        height={height}
                        rx="4"
                        fill={p.isPeak ? '#2563eb' : '#93c5fd'}
                        className="transition-all hover:opacity-80 cursor-pointer"
                        onClick={() => setActiveTooltip(idx)}
                      />
                    );
                  })
                )}

                {/* Peak Highlight Circle */}
                <circle cx="690" cy="42" r="6" fill="#2563eb" stroke="#ffffff" strokeWidth="2.5" />
                <circle cx="105" cy="52" r="3.5" fill="#3b82f6" />
                <circle cx="410" cy="48" r="3.5" fill="#3b82f6" />
              </svg>

              {/* Floating Tooltip Card */}
              {activeTooltip !== null && (
                <div
                  className="absolute top-4 right-8 sm:right-20 rounded-lg p-3 shadow-xl text-left border z-10 pointer-events-none transition-all bg-white border-slate-200 text-slate-800 dark:bg-[#0F172A] dark:border-[#334155] dark:text-[#F8FAFC]"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-blue-600 dark:text-[#38BDF8]">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-400/40 inline-block"></span>
                    <span>CN, 25/10/2026: 82 điểm</span>
                  </div>
                  <div className="text-[11px] mt-1.5 flex flex-col gap-1 font-medium text-slate-700 dark:text-[#F8FAFC]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 inline-block shrink-0"></span>
                      <span>1 Task hoàn thành (Liều kế X-quang)</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-[#E2E8F0]">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 inline-block shrink-0"></span>
                      <span>4.2h Focus AI • Vượt chỉ tiêu +12%</span>
                    </span>
                  </div>
                </div>
              )}

              {/* X-Axis Labels */}
              <div className="w-full flex justify-between pl-10 pr-2 pt-1 text-[11px] text-slate-400 dark:text-[#777]">
                {trendPoints.map((p, idx) => (
                  <span
                    key={idx}
                    className={`cursor-pointer ${p.isPeak ? 'text-blue-600 dark:text-[#D4AF37] font-bold' : ''}`}
                    onClick={() => setActiveTooltip(idx)}
                  >
                    {p.day}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom Legend & AI Synthesis Banner */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-[#888]">
                <span className="font-bold text-slate-700 dark:text-[#AAA]">CHÚ THÍCH:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 dark:bg-[#202020] text-blue-700 dark:text-[#D4AF37] text-xs font-medium">
                  <span className="w-2 h-2 rounded-sm bg-blue-600 dark:bg-[#D4AF37]"></span> Điểm năng suất (0-100)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-[#222] text-xs text-sky-600 dark:text-sky-400">
                  <span className="w-3 h-0.5 bg-sky-400 inline-block"></span> Đường TB động 7 ngày
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-[#222] text-xs text-blue-600 dark:text-blue-400">
                  <span className="w-3 h-0.5 border-b border-dashed border-blue-500 inline-block"></span> Mục tiêu 80+
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-[#1A1A1A] text-blue-800 dark:text-[#CCC] text-xs">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-[#D4AF37]" />
                <span><strong>Tổng kết 30 ngày:</strong> 10% số ngày đạt chuẩn hiệu suất cao &gt;80đ.</span>
              </div>
            </div>
          </div>

          {/* Chart Card 2: Weekly Performance & AI Focus Hours (Dual Axis) */}
          <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#151515] shadow-xs border border-slate-200 dark:border-[#2A2A2A] flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-[#202020] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      Hiệu Suất Tuần & Giờ Tập Trung AI
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 dark:bg-[#222] dark:text-emerald-400">
                      WEEKLY PERFORMANCE
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#888]">
                    Đối chiếu tỷ lệ hoàn thành công việc (%) với giờ tập trung sâu (Flow State 7 ngày)
                  </p>
                </div>
              </div>
            </div>

            {/* Dual Axis Chart Visual */}
            <div className="relative w-full h-64 bg-slate-50/50 dark:bg-[#111111] rounded-xl p-3 select-none border border-slate-100 dark:border-[#222]">
              <svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 700 200">
                {/* Guidelines */}
                <line x1="40" x2="660" y1="20" y2="20" stroke="#EEF2F6" strokeWidth="1" className="dark:stroke-[#222]" />
                <line x1="40" x2="660" y1="60" y2="60" stroke="#EEF2F6" strokeWidth="1" className="dark:stroke-[#222]" />
                <line x1="40" x2="660" y1="100" y2="100" stroke="#EEF2F6" strokeWidth="1" className="dark:stroke-[#222]" />
                <line x1="40" x2="660" y1="140" y2="140" stroke="#EEF2F6" strokeWidth="1" className="dark:stroke-[#222]" />
                <line x1="40" x2="660" y1="175" y2="175" stroke="#CBD5E1" strokeWidth="1.5" className="dark:stroke-[#333]" />

                {/* Threshold 4.0h Line */}
                <line x1="40" x2="660" y1="80" y2="80" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />
                <text x="610" y="75" fill="#f59e0b" fontSize="9" fontWeight="600" fontFamily="Inter">Chuẩn 4.0h Focus</text>

                {/* Left Axis (%) */}
                <text x="32" y="24" textAnchor="end" fill="#94A3B8" fontSize="9" fontFamily="Inter">100%</text>
                <text x="32" y="64" textAnchor="end" fill="#94A3B8" fontSize="9" fontFamily="Inter">75%</text>
                <text x="32" y="104" textAnchor="end" fill="#94A3B8" fontSize="9" fontFamily="Inter">50%</text>
                <text x="32" y="144" textAnchor="end" fill="#94A3B8" fontSize="9" fontFamily="Inter">25%</text>
                <text x="32" y="178" textAnchor="end" fill="#94A3B8" fontSize="9" fontFamily="Inter">0%</text>

                {/* Right Axis (Hours) */}
                <text x="670" y="24" fill="#94A3B8" fontSize="9" fontFamily="Inter">8h</text>
                <text x="670" y="64" fill="#94A3B8" fontSize="9" fontFamily="Inter">6h</text>
                <text x="670" y="104" fill="#94A3B8" fontSize="9" fontFamily="Inter">4h</text>
                <text x="670" y="144" fill="#94A3B8" fontSize="9" fontFamily="Inter">2h</text>
                <text x="670" y="178" fill="#94A3B8" fontSize="9" fontFamily="Inter">0h</text>

                {/* BARS: Completion Rates */}
                {weekDays.map((d, i) => {
                  const x = 75 + i * 85;
                  const barH = d.completion === 100 ? 155 : 115;
                  const y = d.completion === 100 ? 20 : 60;
                  return (
                    <rect
                      key={i}
                      x={x}
                      y={y}
                      width="28"
                      height={barH}
                      rx="3"
                      fill={d.highlight ? '#10b981' : '#34d399'}
                      fillOpacity={d.highlight ? 0.9 : 0.75}
                    />
                  );
                })}

                {/* LINE: AI Focus Hours */}
                <path
                  d="M 89 140 L 174 76 L 259 80 L 344 84 L 429 78 L 514 90 L 599 88"
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Nodes */}
                {[
                  { cx: 89, cy: 140 },
                  { cx: 174, cy: 76, main: true },
                  { cx: 259, cy: 80 },
                  { cx: 344, cy: 84 },
                  { cx: 429, cy: 78 },
                  { cx: 514, cy: 90 },
                  { cx: 599, cy: 88 },
                ].map((n, i) => (
                  <circle
                    key={i}
                    cx={n.cx}
                    cy={n.cy}
                    r={n.main ? 5.5 : 4.5}
                    fill={n.main ? '#b45309' : '#f59e0b'}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                ))}
              </svg>

              {/* X-Axis Labels */}
              <div className="grid grid-cols-7 text-center pl-10 pr-10 text-[11px] text-slate-500 dark:text-[#888]">
                {weekDays.map((d, i) => (
                  <span key={i} className={d.highlight ? 'text-amber-600 dark:text-[#D4AF37] font-bold' : ''}>
                    {d.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Operations Sidebar */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          {/* AI Insights Card */}
          <div className="p-5 rounded-xl bg-white dark:bg-[#151515] shadow-xs border border-slate-200 dark:border-[#2A2A2A] flex flex-col gap-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#222]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-[#D4AF37]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Chiến Lược Tối Ưu Hóa (AI Insights)
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-[#222] dark:text-[#D4AF37]">
                LIVE RAG
              </span>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-[#AAA]">
              <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-[#1A1A1A] border border-blue-100 dark:border-[#333]">
                <strong className="text-slate-900 dark:text-white block mb-1">
                  💡 Nhịp điệu làm việc cao nhất:
                </strong>
                Chủ Nhật (25/10) đạt kỷ lục với 4.2 giờ tập trung sâu và 82 điểm năng suất. Bạn hoàn thành tốt nhất khi bắt đầu phiên làm việc lúc 19:00.
              </div>

              <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-[#1A1A1A] border border-amber-100 dark:border-[#333]">
                <strong className="text-slate-900 dark:text-white block mb-1">
                  🎯 Đề xuất Ma trận Covey:
                </strong>
                Tập trung thêm 15% quỹ thời gian cho các nhiệm vụ <strong>Q2 (Chiến lược)</strong> như kiểm định định kỳ và lập kế hoạch quý để ngăn chặn khủng hoảng gấp.
              </div>
            </div>
          </div>

          {/* Eisenhower Breakdown 30 Days */}
          <div className="p-5 rounded-xl bg-white dark:bg-[#151515] shadow-xs border border-slate-200 dark:border-[#2A2A2A] flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#222]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600 dark:text-[#D4AF37]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Phân Bổ Ma Trận Eisenhower
                </h3>
              </div>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="text-xs font-semibold text-blue-600 dark:text-[#D4AF37] hover:underline"
              >
                Chi tiết
              </button>
            </div>

            <div className="space-y-3">
              {/* Q1 */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-rose-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> Q1 • Làm ngay
                  </span>
                  <span className="text-slate-500 dark:text-[#777] font-medium">{q1Count} việc ({totalTasks > 0 ? Math.round((q1Count / totalTasks) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#222] overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${totalTasks > 0 ? (q1Count / totalTasks) * 100 : 0}%` }}></div>
                </div>
              </div>

              {/* Q2 */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-amber-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> Q2 • Lên lịch (Chiến lược)
                  </span>
                  <span className="text-slate-500 dark:text-[#777] font-medium">{q2Count} việc ({q2Percent}%)</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#222] overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${q2Percent}%` }}></div>
                </div>
              </div>

              {/* Q3 */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-sky-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500"></span> Q3 • Ủy quyền
                  </span>
                  <span className="text-slate-500 dark:text-[#777] font-medium">{q3Count} việc ({totalTasks > 0 ? Math.round((q3Count / totalTasks) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#222] overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${totalTasks > 0 ? (q3Count / totalTasks) * 100 : 0}%` }}></div>
                </div>
              </div>

              {/* Q4 */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-500 dark:text-[#888] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span> Q4 • Loại bỏ
                  </span>
                  <span className="text-slate-500 dark:text-[#777] font-medium">{q4Count} việc ({totalTasks > 0 ? Math.round((q4Count / totalTasks) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#222] overflow-hidden">
                  <div className="h-full bg-slate-400 rounded-full" style={{ width: `${totalTasks > 0 ? (q4Count / totalTasks) * 100 : 0}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Firestore & Vector Status Card */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50/40 dark:from-[#181818] dark:to-[#121212] border border-blue-100 dark:border-[#2A2A2A] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-[#D4AF37]" />
                Firestore Embeddings Cloud
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-xs text-slate-600 dark:text-[#AAA]">
              Vector semantic search đồng bộ thời gian thực với {notes.length} ghi chú và {files.length} tệp Google Drive.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
