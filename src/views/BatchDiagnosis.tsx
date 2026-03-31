import React, { useState } from 'react';
import { Upload, Play, Download } from 'lucide-react';

export default function BatchDiagnosis() {
  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">批量诊断</h1>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
          <Upload className="w-12 h-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-slate-700">上传对话数据</h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">支持 Excel / CSV 格式，包含 student_id, session_id, dialogue 字段</p>
          <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors">
            选择文件
          </button>
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-medium text-slate-800 mb-4">处理队列</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-600">文件名</th>
                  <th className="px-4 py-3 font-medium text-slate-600">记录数</th>
                  <th className="px-4 py-3 font-medium text-slate-600">状态</th>
                  <th className="px-4 py-3 font-medium text-slate-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="px-4 py-3 text-slate-800">class_8_physics_dialogues.csv</td>
                  <td className="px-4 py-3 text-slate-600">45</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium">已完成</span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-indigo-600 hover:text-indigo-800 flex items-center text-xs font-medium">
                      <Download className="w-3 h-3 mr-1" /> 导出报告
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-800">class_9_physics_dialogues.csv</td>
                  <td className="px-4 py-3 text-slate-600">32</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">待处理</span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-indigo-600 hover:text-indigo-800 flex items-center text-xs font-medium">
                      <Play className="w-3 h-3 mr-1" /> 开始
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
