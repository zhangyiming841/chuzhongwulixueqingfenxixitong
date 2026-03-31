import React, { useState } from 'react';
import { Play, AlertTriangle, CheckCircle, HelpCircle, MessageSquare } from 'lucide-react';
import { diagnoseDialogue } from '../services/diagnosisService';
import { DiagnosisResult } from '../types';

export default function DiagnosisWorkspace() {
  const [dialogue, setDialogue] = useState('学生：物体停下来是因为惯性消失了。\\n老师：为什么这么说？\\n学生：因为停下来就没有这个力了。');
  const [studentId, setStudentId] = useState('小李');
  const [sessionId, setSessionId] = useState('PHY_2026_03_17_C01');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await diagnoseDialogue(dialogue, studentId, sessionId);
      setResult(res);
    } catch (error) {
      console.error(error);
      alert('诊断失败，请检查控制台');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">诊断工作台</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Input Section */}
        <div className="flex flex-col gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">输入对话</h2>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">学生 ID</label>
              <input 
                type="text" 
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">会话 ID</label>
              <input 
                type="text" 
                value={sessionId}
                onChange={e => setSessionId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-[300px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">师生对话记录</label>
            <textarea 
              value={dialogue}
              onChange={e => setDialogue(e.target.value)}
              className="flex-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
              placeholder="请输入包含角色标注的对话文本..."
            />
          </div>

          <button 
            onClick={handleAnalyze}
            disabled={isAnalyzing || !dialogue.trim()}
            className="flex items-center justify-center w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? (
              <span className="flex items-center"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>分析中...</span>
            ) : (
              <span className="flex items-center"><Play className="w-4 h-4 mr-2" />开始诊断</span>
            )}
          </button>
        </div>

        {/* Output Section */}
        <div className="flex flex-col bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-auto">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">诊断结果</h2>
          
          {result ? (
            <div className="space-y-6">
              {/* Confidence Warning */}
              {result.mastery_assessment.confidence < 0.75 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-start">
                  <AlertTriangle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">建议人工复核</p>
                    <p className="text-sm mt-1">AI 诊断置信度较低 ({result.mastery_assessment.confidence})，可能存在误判。</p>
                  </div>
                </div>
              )}

              {/* Knowledge Point */}
              <section>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">知识点定位</h3>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="font-medium text-slate-800">{result.knowledge_point.chapter} / {result.knowledge_point.concept}</p>
                  <p className="text-sm text-slate-600 mt-1">{result.knowledge_point.standard_definition}</p>
                </div>
              </section>

              {/* Mastery & Block */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">掌握层级</h3>
                  <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 h-full">
                    <div className="flex items-center mb-1">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold mr-2">
                        {result.mastery_assessment.level}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{result.mastery_assessment.level_description}</p>
                    <p className="text-xs text-slate-500 mt-2 italic">证据: {result.mastery_assessment.evidence}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">思维阻滞点</h3>
                  <div className="bg-rose-50 p-3 rounded-lg border border-rose-100 h-full">
                    <p className="font-medium text-rose-800">{result.cognitive_block.type}</p>
                    <p className="text-sm text-rose-700 mt-1">{result.cognitive_block.description}</p>
                    <p className="text-xs text-rose-600 mt-2 font-medium">根因: {result.cognitive_block.root_cause}</p>
                  </div>
                </div>
              </section>

              {/* Guided Questions */}
              <section>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                  <HelpCircle className="w-4 h-4 mr-1" /> 引导问题建议
                </h3>
                <ul className="space-y-2">
                  {result.guided_questions.map((q, i) => (
                    <li key={i} className="flex items-start bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-200 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold mr-3">{i + 1}</span>
                      <span className="text-emerald-900 text-sm pt-0.5">{q}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Teacher Recommendation */}
              <section>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">教学建议</h3>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm text-slate-700">
                  {result.teacher_recommendation}
                </div>
              </section>

              <div className="text-xs text-slate-400 border-t border-slate-100 pt-4 mt-4">
                RAG 溯源: {result.rag_source}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
              <p>输入对话并点击"开始诊断"查看分析结果</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
