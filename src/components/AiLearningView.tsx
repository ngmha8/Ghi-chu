import React, { useState, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Zap,
  TrendingUp,
  Award,
  BookOpen,
  Filter,
  ShieldCheck,
  Compass,
  ArrowRight,
  Bot,
  UserCheck,
  Sliders,
  Settings2,
  Save,
  MessageSquare,
  Volume2
} from 'lucide-react';
import { AiMemoryFact, AiLearningInsight, AiLearningStats, AiMemoryCategory, AiPersonaConfig, AiCommunicationStyle } from '../types/index.ts';
import { api } from '../services/api.ts';

interface AiLearningViewProps {
  memories: AiMemoryFact[];
  insights: AiLearningInsight[];
  stats: AiLearningStats | null;
  onRefresh: () => void;
  onOpenAiDrawerWithPrompt?: (prompt: string) => void;
}

const CATEGORY_LABELS: Record<AiMemoryCategory, { label: string; color: string; icon: any }> = {
  preference: { label: 'Sở thích & Phong cách', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: Sparkles },
  identity: { label: 'Danh tính cá nhân', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: UserCheck },
  rule: { label: 'Quy tắc bắt buộc', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: ShieldCheck },
  workflow: { label: 'Quy trình làm việc', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: Sliders },
  domain_knowledge: { label: 'Chuyên môn trọng tâm', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: BookOpen },
  habit: { label: 'Thói quen sinh hoạt', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: Compass },
};

const COMMUNICATION_STYLES: { id: AiCommunicationStyle; label: string; desc: string; icon: string }[] = [
  {
    id: 'warm_empathetic',
    label: '🌿 Tận tụy & Thấu cảm ấm áp',
    desc: 'Ân cần, chu đáo, tôn trọng cảm xúc và luôn mang lại cảm giác an tâm tuyệt đối.',
    icon: '🌿',
  },
  {
    id: 'executive_concise',
    label: '⚡ Chánh văn phòng súc tích & Hành động',
    desc: 'Đi thẳng vào trọng tâm, tối đa hóa thời gian, súc tích và chính xác từng chi tiết.',
    icon: '⚡',
  },
  {
    id: 'strategic_advisor',
    label: '🧠 Cố vấn chiến lược & Phân tích sâu',
    desc: 'Tư duy đa chiều, phân tích rủi ro - cơ hội và định hướng dài hạn.',
    icon: '🧠',
  },
  {
    id: 'energetic_action',
    label: '🔥 Tràn đầy năng lượng & Thúc đẩy bứt phá',
    desc: 'Truyền cảm hứng, khuyến khích hành động ngay và xóa tan trì hoãn.',
    icon: '🔥',
  },
];

export const AiLearningView: React.FC<AiLearningViewProps> = ({
  memories,
  insights,
  stats,
  onRefresh,
  onOpenAiDrawerWithPrompt,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isReflecting, setIsReflecting] = useState(false);
  const [reflectMessage, setReflectMessage] = useState<string | null>(null);

  // Persona State
  const [personaConfig, setPersonaConfig] = useState<AiPersonaConfig | null>(null);
  const [isSavingPersona, setIsSavingPersona] = useState(false);
  const [personaSaveSuccess, setPersonaSaveSuccess] = useState(false);

  // Modal / Form state for adding new memory fact
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFact, setNewFact] = useState('');
  const [newCategory, setNewCategory] = useState<AiMemoryCategory>('preference');
  const [newConfidence, setNewConfidence] = useState(0.95);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPersona();
  }, []);

  const loadPersona = async () => {
    try {
      const data = await api.getAiPersonaConfig();
      setPersonaConfig(data);
    } catch (err) {
      console.warn('Could not load AI Persona config:', err);
    }
  };

  const handleSavePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personaConfig) return;
    setIsSavingPersona(true);
    try {
      const updated = await api.saveAiPersonaConfig(personaConfig);
      setPersonaConfig(updated);
      setPersonaSaveSuccess(true);
      setTimeout(() => setPersonaSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Lỗi khi lưu cấu hình: ${err?.message || 'Không xác định'}`);
    } finally {
      setIsSavingPersona(false);
    }
  };

  const filteredMemories = selectedCategory === 'all'
    ? memories
    : memories.filter(m => m.category === selectedCategory);

  const handleReflectNow = async () => {
    setIsReflecting(true);
    setReflectMessage(null);
    try {
      const res = await api.triggerAiSelfReflection();
      setReflectMessage(res.message || 'Đã hoàn thành phiên tự học thành công!');
      onRefresh();
      setTimeout(() => setReflectMessage(null), 6000);
    } catch (err: any) {
      setReflectMessage(`⚠️ ${err?.message || 'Lỗi khi kích hoạt tự học'}`);
    } finally {
      setIsReflecting(false);
    }
  };

  const handleToggleMemory = async (id: string) => {
    try {
      await api.toggleAiMemory(id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ký ức tự học này khỏi bộ nhớ dài hạn của AI?')) return;
    try {
      await api.deleteAiMemory(id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim()) return;
    setIsSaving(true);
    try {
      await api.saveAiMemory({
        fact: newFact.trim(),
        category: newCategory,
        confidence: newConfidence,
        source: 'explicit',
        occurrences: 1,
        isActive: true,
      });
      setNewFact('');
      setIsAddModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const learningScore = stats?.learningScore || 75;
  const learningLevel = stats?.learningLevel || 'Đồng hành thông thái (Wise Companion)';

  return (
    <div className="space-y-8 animate-fadeIn pb-16">
      {/* Top Banner / AI Cognitive State Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950/60 via-zinc-900 to-purple-950/50 border border-indigo-500/20 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <Brain className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              Hệ Thống Tự Học & Quản Trị Nhận Thức AI
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              Tâm Trí & Bộ Nhớ Dài Hạn Của AI
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Continuous Active Learning
              </span>
            </h1>
            <p className="text-sm md:text-base text-zinc-300 leading-relaxed">
              Trợ lý AI của bạn liên tục tự động phân tích hành vi, ghi nhận phản hồi, tiếp thu thói quen và quy tắc cá nhân hóa. Mọi ký ức được đồng bộ vĩnh viễn trên Firebase Firestore và áp dụng tức thì vào mọi phiên làm việc.
            </p>
          </div>

          {/* Action Trigger Card */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={handleReflectNow}
              disabled={isReflecting}
              className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isReflecting ? 'animate-spin' : ''}`} />
              {isReflecting ? 'Đang tự học & suy ngẫm...' : '⚡ Tự Học & Suy Ngẫm Ngay'}
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 hover:text-white font-medium text-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              Thêm Ký Ức Mới
            </button>
          </div>
        </div>

        {/* Reflection Alert Message */}
        {reflectMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-indigo-900/40 border border-indigo-500/30 text-indigo-200 text-sm flex items-center gap-3 animate-fadeIn">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{reflectMessage}</span>
          </div>
        )}

        {/* Cognitive Metric Bar */}
        <div className="mt-8 pt-6 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1">
              <Award className="w-3.5 h-3.5 text-indigo-400" /> Cấp độ Thấu hiểu
            </div>
            <div className="text-base font-bold text-white truncate">{learningLevel}</div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Điểm Tương Thích AI
            </div>
            <div className="text-xl font-bold text-emerald-400 flex items-center gap-2">
              {learningScore}/100
              <div className="w-16 bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${learningScore}%` }} />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1">
              <Brain className="w-3.5 h-3.5 text-purple-400" /> Tổng Ký ức Khắc sâu
            </div>
            <div className="text-xl font-bold text-purple-300">{memories.length} sự thật</div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="text-xs text-zinc-400 flex items-center gap-1.5 mb-1">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Đúc kết Chiến lược
            </div>
            <div className="text-xl font-bold text-amber-300">{insights.length} insight</div>
          </div>
        </div>
      </div>

      {/* AI Persona & Honorifics Customizer Card */}
      {personaConfig && (
        <form
          onSubmit={handleSavePersona}
          className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-6 md:p-7 space-y-6 shadow-xl relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Thiết Lập Xưng Hô & Phong Cách Đồng Hành AI
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
                    Strict Persona
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Chỉ định danh xưng để AI thấu hiểu và giao tiếp chuẩn xác, ấm áp như một cộng sự đắc lực
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingPersona}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSavingPersona ? 'Đang lưu...' : 'Lưu Thay Đổi'}
            </button>
          </div>

          {personaSaveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Đã lưu thành công cấu hình Xưng hô & Tính cách AI lên hệ thống Firestore!</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* User Honorific */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300">
                👤 Danh xưng AI gọi bạn (User Honorific):
              </label>
              <input
                type="text"
                value={personaConfig.userHonorific || ''}
                onChange={(e) => setPersonaConfig({ ...personaConfig, userHonorific: e.target.value })}
                placeholder="Ví dụ: Anh Nam, Chị Mai, Sếp, Bạn..."
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
              <p className="text-[11px] text-zinc-500 italic">
                AI sẽ luôn gọi bạn bằng danh xưng này (VD: &ldquo;Chào Anh Nam&rdquo;, &ldquo;Em đã cập nhật xong việc cho Anh...&rdquo;)
              </p>
            </div>

            {/* AI Honorific */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300">
                🤖 Danh xưng AI tự gọi mình (AI Honorific):
              </label>
              <input
                type="text"
                value={personaConfig.aiHonorific || ''}
                onChange={(e) => setPersonaConfig({ ...personaConfig, aiHonorific: e.target.value })}
                placeholder="Ví dụ: Em, Tôi, Trợ lý, Cố vấn..."
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
              <p className="text-[11px] text-zinc-500 italic">
                Cách AI tự xưng trong câu trả lời (VD: &ldquo;Em xin tóm tắt...&rdquo;, &ldquo;Tôi sẽ hỗ trợ bạn ngay&rdquo;)
              </p>
            </div>
          </div>

          {/* Communication Style Selector */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-zinc-300">
              🎭 Phong cách giao tiếp & đồng hành chủ đạo:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {COMMUNICATION_STYLES.map((style) => {
                const isSelected = personaConfig.communicationStyle === style.id;
                return (
                  <button
                    type="button"
                    key={style.id}
                    onClick={() => setPersonaConfig({ ...personaConfig, communicationStyle: style.id })}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 text-white shadow-md shadow-amber-500/5'
                        : 'bg-zinc-800/60 border-zinc-700/70 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{style.icon}</span>
                        <span>{style.label.replace(/^[^\s]+\s/, '')}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        {style.desc}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="mt-2.5 flex items-center gap-1 text-[10px] text-amber-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Đang áp dụng
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-zinc-800/60">
            {/* Focus Domain */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300">
                📚 Lĩnh vực & Chuyên môn trọng tâm:
              </label>
              <input
                type="text"
                value={personaConfig.focusDomain || ''}
                onChange={(e) => setPersonaConfig({ ...personaConfig, focusDomain: e.target.value })}
                placeholder="Ví dụ: Công nghệ thông tin, Quản trị doanh nghiệp, Y tế & Bức xạ..."
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Custom Directives */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300">
                🔒 Lời nhắc quy tắc đặc biệt (Custom Instructions):
              </label>
              <input
                type="text"
                value={personaConfig.customInstructions || ''}
                onChange={(e) => setPersonaConfig({ ...personaConfig, customInstructions: e.target.value })}
                placeholder="Ví dụ: Luôn tóm tắt hành động trước 16h00, ưu tiên phân tích sâu nguyên nhân gốc rễ..."
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>
        </form>
      )}

      {/* Autonomous Cognitive Insights Section */}
      {insights.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              Đúc Kết Chiến Lược & Mẫu Hình Nhận Thức (Cognitive Reflections)
            </h2>
            <span className="text-xs text-zinc-400">Tự động sinh từ dữ liệu thực tế</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className="group p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-amber-500/30 transition-all shadow-lg hover:shadow-amber-500/5 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">
                      {ins.category}
                    </span>
                    <span className="text-xs text-zinc-500">
                      Tin cậy: {Math.round((ins.confidenceScore || 0.85) * 100)}%
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white group-hover:text-amber-300 transition-colors">
                    {ins.title}
                  </h3>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {ins.summary}
                  </p>
                </div>

                <div className="mt-4 pt-3.5 border-t border-zinc-800/60 flex items-start gap-2.5 text-xs text-amber-300/90 bg-amber-950/20 p-3 rounded-xl border border-amber-500/10">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-200">Lời khuyên hành động:</strong> {ins.actionableAdvice}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learned Facts & Long-Term Memories Section */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <Brain className="w-5 h-5 text-indigo-400" />
              Ký Ức & Quy Tắc Cá Nhân Hóa Đã Tiếp Thu ({filteredMemories.length})
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              AI liên tục tra cứu những ký ức này để điều chỉnh phong cách phản hồi và tự động hóa công việc cho bạn
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Tất cả ({memories.length})
            </button>
            {Object.entries(CATEGORY_LABELS).map(([catKey, config]) => {
              const count = memories.filter(m => m.category === catKey).length;
              return (
                <button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedCategory === catKey
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {config.label.split(' ')[0]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Memory Fact Cards Grid */}
        {filteredMemories.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800">
            <Brain className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-zinc-300">Chưa có ký ức nào trong phân loại này</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
              Bạn có thể nói với AI bất kỳ thói quen nào như: &quot;Từ nay hãy xưng hô là Alex&quot;, &quot;Luôn ưu tiên giải quyết việc gấp trước&quot; để AI tự động học tập!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMemories.map((mem) => {
              const catConfig = CATEGORY_LABELS[mem.category] || CATEGORY_LABELS.preference;
              const Icon = catConfig.icon;
              const isInactive = mem.isActive === false;

              return (
                <div
                  key={mem.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isInactive
                      ? 'bg-zinc-900/30 border-zinc-800/60 opacity-60'
                      : 'bg-zinc-900/80 border-zinc-800 hover:border-indigo-500/40 shadow-md'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header: Category Badge & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${catConfig.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {catConfig.label}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                          {Math.round((mem.confidence || 0.9) * 100)}% tin cậy
                        </span>
                      </div>
                    </div>

                    {/* Fact Body */}
                    <p className={`text-sm leading-relaxed ${isInactive ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                      &ldquo;{mem.fact}&rdquo;
                    </p>
                  </div>

                  {/* Footer: Metadata & Actions */}
                  <div className="mt-4 pt-3.5 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
                    <div className="flex items-center gap-2">
                      <span>Củng cố: <strong>{mem.occurrences || 1} lần</strong></span>
                      <span>•</span>
                      <span className="capitalize">{mem.source || 'chat'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleMemory(mem.id)}
                        title={isInactive ? 'Kích hoạt lại ký ức' : 'Tạm vô hiệu hóa ký ức'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isInactive ? 'text-zinc-500 hover:text-emerald-400' : 'text-emerald-400 hover:text-zinc-400'
                        }`}
                      >
                        {isInactive ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => handleDeleteMemory(mem.id)}
                        title="Xóa vĩnh viễn ký ức"
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Memory Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-400" />
                Khắc Sâu Ký Ức Mới Cho AI
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMemory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Phân loại Ký ức:
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as AiMemoryCategory)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Nội dung Ký ức / Quy tắc / Sở thích:
                </label>
                <textarea
                  rows={4}
                  value={newFact}
                  onChange={(e) => setNewFact(e.target.value)}
                  placeholder="Ví dụ: Người dùng thích nhận các đề xuất code bằng TypeScript chuẩn và luôn muốn deadline công việc theo giờ chiều Việt Nam (17h00)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Mức độ tin cậy: {Math.round(newConfidence * 100)}%
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={newConfidence}
                  onChange={(e) => setNewConfidence(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !newFact.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 disabled:opacity-50"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu Ký Ức'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
