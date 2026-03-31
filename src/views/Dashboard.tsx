import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const data = [
  { name: '概念具象化', count: 12, color: '#f43f5e' },
  { name: '因果倒置', count: 8, color: '#f97316' },
  { name: '数量混淆', count: 15, color: '#8b5cf6' },
  { name: '情境迁移失败', count: 5, color: '#3b82f6' },
  { name: '模型建构失败', count: 3, color: '#10b981' },
];

export default function Dashboard() {
  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">学情看板</h1>
        <select className="px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
          <option>八年级 (1) 班</option>
          <option>八年级 (2) 班</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <h3 className="text-sm font-medium text-slate-500 mb-1">本周诊断对话数</h3>
          <p className="text-4xl font-bold text-slate-800">128</p>
          <p className="text-sm text-emerald-600 mt-2 flex items-center">
            ↑ 12% 较上周
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <h3 className="text-sm font-medium text-slate-500 mb-1">高频薄弱知识点</h3>
          <p className="text-2xl font-bold text-slate-800">牛顿第一定律 (惯性)</p>
          <p className="text-sm text-rose-500 mt-2">
            32 名学生存在概念误区
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <h3 className="text-sm font-medium text-slate-500 mb-1">引导有效率</h3>
          <p className="text-4xl font-bold text-slate-800">76%</p>
          <p className="text-sm text-slate-500 mt-2">
            基于课后测验反馈
          </p>
        </div>

        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">班级思维阻滞点分布</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Students */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">需关注学生</h3>
          <div className="space-y-4">
            {[
              { name: '小李', issue: '惯性概念具象化', urgency: 'high' },
              { name: '张三', issue: '受力分析迁移失败', urgency: 'high' },
              { name: '王五', issue: '数量关系混淆', urgency: 'medium' },
              { name: '赵六', issue: '因果倒置', urgency: 'medium' },
            ].map((student, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <p className="font-medium text-slate-800">{student.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{student.issue}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${student.urgency === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                  {student.urgency === 'high' ? '高优干预' : '持续关注'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
