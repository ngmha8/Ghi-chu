import React, { useState } from 'react';
import {
  ShieldCheck,
  Database,
  Layers,
  Cpu,
  Server,
  Cloud,
  Bot,
  Key,
  Copy,
  Check
} from 'lucide-react';

export const SystemArchView: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const postgresSql = `-- PostgreSQL 16 Database Schema
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  google_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
  status VARCHAR(20) DEFAULT 'todo', -- todo, in_progress, completed, canceled
  tags TEXT[],
  recurring_rule JSONB, -- { type: 'daily' | 'weekly' | 'monthly', interval: 1 }
  attached_file_ids TEXT[],
  reminder_offset_minutes INT DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  tags TEXT[],
  linked_task_ids TEXT[],
  attached_file_ids TEXT[],
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  size BIGINT,
  web_view_link TEXT,
  category VARCHAR(50),
  is_synced_to_drive BOOLEAN DEFAULT TRUE,
  drive_file_id VARCHAR(255),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;

  const handleCopyCode = (code: string, sectionKey: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 1500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#151515] border border-[#2A2A2A] p-5 rounded-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-sm bg-[#1A1A1A] text-[#D4AF37] border border-[#D4AF37]/30">
            <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-xl font-editorial-serif font-bold text-white">Kiến trúc Hệ thống & DB Schema</h1>
            <p className="text-xs text-[#888888] italic">Thiết kế chuẩn Senior Fullstack Architect (PostgreSQL, Redis, Gemini AI, OAuth2 & Telegram)</p>
          </div>
        </div>
      </div>

      {/* System Architecture Visual Diagram */}
      <div className="p-6 rounded-sm bg-[#151515] border border-[#2A2A2A] space-y-6">
        <h2 className="text-sm font-editorial-serif font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#D4AF37]" />
          <span>Sơ đồ Khối Kiến trúc Hệ thống (System Architecture Diagram)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center text-xs">
          {/* Layer 1: Frontend */}
          <div className="p-4 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] space-y-2">
            <div className="p-2 rounded-sm bg-[#1A1A1A] text-[#D4AF37] font-bold mx-auto w-fit border border-[#2A2A2A]">
              <Cpu className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h3 className="font-editorial-serif font-bold text-white">1. Frontend Layer</h3>
            <p className="text-[11px] text-[#888888]">React 19 + Vite + Tailwind CSS + Dashboard + Chat AI Window</p>
          </div>

          {/* Layer 2: API Gateway / Express Backend */}
          <div className="p-4 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] space-y-2">
            <div className="p-2 rounded-sm bg-[#1A1A1A] text-[#D4AF37] font-bold mx-auto w-fit border border-[#2A2A2A]">
              <Server className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h3 className="font-editorial-serif font-bold text-white">2. Backend Gateway</h3>
            <p className="text-[11px] text-[#888888]">Express.js / NestJS REST APIs + JWT Auth + Rate Limiting</p>
          </div>

          {/* Layer 3: Database & Redis */}
          <div className="p-4 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] space-y-2">
            <div className="p-2 rounded-sm bg-[#1A1A1A] text-[#D4AF37] font-bold mx-auto w-fit border border-[#2A2A2A]">
              <Database className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h3 className="font-editorial-serif font-bold text-white">3. Persistence & Queue</h3>
            <p className="text-[11px] text-[#888888]">PostgreSQL 16 (Tasks, Notes) + Redis Queue Scheduler</p>
          </div>

          {/* Layer 4: AI Engine */}
          <div className="p-4 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] space-y-2">
            <div className="p-2 rounded-sm bg-[#1A1A1A] text-[#D4AF37] font-bold mx-auto w-fit border border-[#2A2A2A]">
              <Cloud className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h3 className="font-editorial-serif font-bold text-white">4. Gemini AI RAG</h3>
            <p className="text-[11px] text-[#888888]">Gemini 3.6 Flash + Internal RAG Context + Search Grounding</p>
          </div>

          {/* Layer 5: Integrations */}
          <div className="p-4 rounded-sm bg-[#0C0C0C] border border-[#2A2A2A] space-y-2">
            <div className="p-2 rounded-sm bg-[#1A1A1A] text-[#D4AF37] font-bold mx-auto w-fit border border-[#2A2A2A]">
              <Bot className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h3 className="font-editorial-serif font-bold text-white">5. External Integrations</h3>
            <p className="text-[11px] text-[#888888]">Google Drive OAuth2 Sync + Telegram Bot Webhook</p>
          </div>
        </div>
      </div>

      {/* PostgreSQL DDL Schema Documentation */}
      <div className="p-6 rounded-sm bg-[#151515] border border-[#2A2A2A] space-y-4">
        <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#D4AF37]" />
            <h2 className="text-sm font-editorial-serif font-bold text-white">PostgreSQL 16 Schema Definitions (DDL)</h2>
          </div>

          <button
            onClick={() => handleCopyCode(postgresSql, 'pg')}
            className="px-3 py-1.5 rounded-sm bg-[#0C0C0C] hover:bg-[#D4AF37] hover:text-black text-xs font-bold uppercase tracking-wider text-[#E0E0E0] border border-[#2A2A2A] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedSection === 'pg' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-[#D4AF37]" />}
            <span>{copiedSection === 'pg' ? 'Đã sao chép' : 'Sao chép SQL'}</span>
          </button>
        </div>

        <pre className="p-4 bg-[#0C0C0C] rounded-sm border border-[#2A2A2A] text-[#E0E0E0] text-xs font-mono overflow-x-auto leading-relaxed">
          {postgresSql}
        </pre>
      </div>

      {/* Endpoints Table */}
      <div className="p-6 rounded-sm bg-[#151515] border border-[#2A2A2A] space-y-4">
        <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-3">
          <Key className="w-4 h-4 text-[#D4AF37]" />
          <h2 className="text-sm font-editorial-serif font-bold text-white">API Endpoints Reference Table</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#E0E0E0]">
            <thead className="bg-[#0C0C0C] text-[#888888] font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3 border-b border-[#2A2A2A]">Method</th>
                <th className="p-3 border-b border-[#2A2A2A]">Endpoint</th>
                <th className="p-3 border-b border-[#2A2A2A]">Mô tả</th>
                <th className="p-3 border-b border-[#2A2A2A]">Auth / Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              <tr>
                <td className="p-3 font-mono font-bold text-[#D4AF37]">GET/POST/PUT/DELETE</td>
                <td className="p-3 font-mono text-white">/api/tasks</td>
                <td className="p-3">CRUD Quản lý công việc, priority, tags, deadline & recurring rules</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] uppercase text-[10px] font-bold tracking-wider">JWT Token</span></td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-[#D4AF37]">GET/POST/PUT/DELETE</td>
                <td className="p-3 font-mono text-white">/api/notes</td>
                <td className="p-3">CRUD Quản lý ghi chú Markdown, auto-save & liên kết tasks/files</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] uppercase text-[10px] font-bold tracking-wider">JWT Token</span></td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-[#D4AF37]">GET/POST/DELETE</td>
                <td className="p-3 font-mono text-white">/api/files</td>
                <td className="p-3">Tải lên và quản lý metadata tài liệu Google Drive</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] uppercase text-[10px] font-bold tracking-wider">OAuth2 Scope</span></td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-[#D4AF37]">POST</td>
                <td className="p-3 font-mono text-white">/api/telegram/webhook</td>
                <td className="p-3">Nhận và phản hồi các lệnh Telegram (/tasks, /today, /ask) 2 chiều</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] uppercase text-[10px] font-bold tracking-wider">Bot Secret</span></td>
              </tr>
              <tr>
                <td className="p-3 font-mono font-bold text-[#D4AF37]">POST</td>
                <td className="p-3 font-mono text-white">/api/chat</td>
                <td className="p-3">Chat AI On-Demand với Gemini 3.6 Flash + RAG Context + Web Search</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded-sm bg-[#0C0C0C] text-[#D4AF37] border border-[#2A2A2A] uppercase text-[10px] font-bold tracking-wider">Server Secret</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
