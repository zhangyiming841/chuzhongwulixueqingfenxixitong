import React, { useState } from 'react';
import { Star } from 'lucide-react';

export default function Evaluation() {
  const [scores, setScores] = useState({
    concept: 0,
    block: 0,
    question: 0,
    format: 0
  });

  const handleScore = (category: keyof typeof scores, value: number) => {
    setScores(prev => ({ ...prev, [category]: value }));
  };

  const renderStars = (category: keyof typeof scores) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => handleScore(category, star)}
            className={`p-1 transition-colors ${scores[category] >= star ? 'text-amber-400' : 'text-slate-200 hover:text-amber-200'}`}
          >
            <Star className="w-6 h-6 fill-current" />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">教师人工评估表</h1>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <h3 className="text-sm font-medium text-slate-500 mb-2">待评估诊断记录</h3>
          <p className="text-sm text-slate-800 mb-1"><span className="font-medium">学生:</span> 小李 (PHY_2026_03_17_C01)</p>
          <p className="text-sm text-slate-800"><span className="font-medium">知识点:</span> 惯性</p>
        </div>

        <div className="space-y-8">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-base font-medium text-slate-800">知识点识别准确性 (35%)</label>
              <span className="text-sm text-slate-500">{scores.concept} / 5</span>
            </div>
            <p className="text-sm text-slate-500 mb-3">识别出的核心知识点是否与对话内容实际涉及的物理概念一致？</p>
            {renderStars('concept')}
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-base font-medium text-slate-800">阻滞点定位合理性 (30%)</label>
              <span className="text-sm text-slate-500">{scores.block} / 5</span>
            </div>
            <p className="text-sm text-slate-500 mb-3">阻滞点类型和描述是否准确反映了学生的真实思维问题？</p>
            {renderStars('block')}
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-base font-medium text-slate-800">引导问题有效性 (25%)</label>
              <span className="text-sm text-slate-500">{scores.question} / 5</span>
            </div>
            <p className="text-sm text-slate-500 mb-3">生成的引导问题是否具有真实的课堂教学价值？</p>
            {renderStars('question')}
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-base font-medium text-slate-800">输出格式稳定性 (10%)</label>
              <span className="text-sm text-slate-500">{scores.format} / 5</span>
            </div>
            <p className="text-sm text-slate-500 mb-3">JSON 格式是否完整、字段是否齐全、无解析错误？</p>
            {renderStars('format')}
          </div>

          <div className="pt-6 border-t border-slate-200">
            <label className="block text-base font-medium text-slate-800 mb-2">主要问题简述 (可选)</label>
            <textarea 
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none h-24"
              placeholder="请描述诊断结果中存在的问题..."
            />
          </div>

          <button className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            提交评估
          </button>
        </div>
      </div>
    </div>
  );
}
