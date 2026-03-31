import React, { useState } from 'react';
import { Search, Plus, Edit2, Trash2, FileText } from 'lucide-react';
import { initialKnowledgeBase } from '../store/kbStore';
import { KnowledgeChunk } from '../types';

export default function KnowledgeBase() {
  const [activeTab, setActiveTab] = useState<'concept_definition' | 'misconception' | 'guidance_strategy'>('concept_definition');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChunks = initialKnowledgeBase.filter(chunk => 
    chunk.content_category === activeTab && 
    (chunk.concept_name.includes(searchQuery) || chunk.content.includes(searchQuery))
  );

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">知识库管理</h1>
        <button className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4 mr-2" /> 新增条目
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('concept_definition')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'concept_definition' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              物理知识点库
            </button>
            <button 
              onClick={() => setActiveTab('misconception')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'misconception' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              错误概念库
            </button>
            <button 
              onClick={() => setActiveTab('guidance_strategy')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'guidance_strategy' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              引导策略库
            </button>
          </div>

          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜索知识点..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredChunks.map(chunk => (
              <div key={chunk.id} className="border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors bg-white flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-slate-800 flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-indigo-500" />
                    {chunk.concept_name}
                  </h3>
                  <div className="flex space-x-1">
                    <button className="p-1 text-slate-400 hover:text-indigo-600 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button className="p-1 text-slate-400 hover:text-rose-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="text-xs text-slate-500 mb-3 space-y-1">
                  <p>章节: {chunk.chapter}</p>
                  {chunk.block_type && <p>阻滞点: {chunk.block_type}</p>}
                </div>
                <div className="text-sm text-slate-600 line-clamp-4 bg-slate-50 p-2 rounded border border-slate-100 flex-1 whitespace-pre-wrap font-mono text-xs">
                  {chunk.content}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>{chunk.last_updated}</span>
                  <span className={`px-1.5 py-0.5 rounded ${chunk.review_status === 'reviewed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {chunk.review_status === 'reviewed' ? '已审核' : '待审核'}
                  </span>
                </div>
              </div>
            ))}
            {filteredChunks.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500">
                未找到相关知识条目
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
