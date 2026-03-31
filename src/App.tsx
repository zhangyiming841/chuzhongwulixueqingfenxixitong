import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Brain,
  FileText,
  History,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { diagnoseDialogue } from './services/diagnosisService';
import { KnowledgeChunk, DiagnosisResult, EvaluationForm } from './types';
import { initialKnowledgeBase } from './store/kbStore';

type TabKey = 'workspace' | 'history' | 'knowledge' | 'evaluation';

type SpeechRecognitionCtor = new () => SpeechRecognition;

declare global {
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((event: any) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
  }

  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const STORAGE_KEY = 'physics-mvp-local-state';

type LocalEvaluation = EvaluationForm & {
  id: string;
  diagnosis_id: string;
  created_at: string;
};

type LocalState = {
  knowledgeBase: KnowledgeChunk[];
  diagnoses: DiagnosisResult[];
  evaluations: LocalEvaluation[];
};

const emptyEvaluation: EvaluationForm = {
  concept_accuracy: 0,
  block_identification: 0,
  question_effectiveness: 0,
  format_stability: 0,
  weighted_score: 0,
  review_suggestion: 'pass',
  key_issues: '',
};

const emptyChunkDraft = {
  concept_name: '',
  chapter: '',
  grade: '初中八年级下',
  content_category: 'concept_definition' as const,
  block_type: '',
  source: '教师录入',
  constructed_by: '教师',
  review_status: 'pending' as const,
  content: '',
};

function readState(): LocalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { knowledgeBase: initialKnowledgeBase, diagnoses: [], evaluations: [] };
    }
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    return {
      knowledgeBase: parsed.knowledgeBase?.length ? parsed.knowledgeBase : initialKnowledgeBase,
      diagnoses: parsed.diagnoses ?? [],
      evaluations: parsed.evaluations ?? [],
    };
  } catch {
    return { knowledgeBase: initialKnowledgeBase, diagnoses: [], evaluations: [] };
  }
}

function saveState(state: LocalState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatTime(value?: string) {
  if (!value) return '--';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('workspace');
  const [state, setState] = useState<LocalState>(() => readState());
  const [studentId, setStudentId] = useState('小李');
  const [sessionId, setSessionId] = useState(`PHY_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_001`);
  const [dialogue, setDialogue] = useState('学生：物体停下来是因为惯性消失了。\n老师：为什么这么说？\n学生：因为停下来就没有这个力了。');
  const [selectedDiagnosisId, setSelectedDiagnosisId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [chunkDraft, setChunkDraft] = useState(emptyChunkDraft);
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [evaluationDraft, setEvaluationDraft] = useState<EvaluationForm>(emptyEvaluation);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(Boolean(ctor));
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const selectedDiagnosis = useMemo(
    () => state.diagnoses.find((item) => item.id === selectedDiagnosisId) ?? state.diagnoses[0] ?? null,
    [selectedDiagnosisId, state.diagnoses],
  );

  const filteredKnowledge = useMemo(() => {
    return state.knowledgeBase.filter((item) => {
      if (!knowledgeQuery.trim()) return true;
      const haystack = `${item.concept_name} ${item.chapter} ${item.content}`.toLowerCase();
      return haystack.includes(knowledgeQuery.toLowerCase());
    });
  }, [knowledgeQuery, state.knowledgeBase]);

  async function handleAnalyze() {
    if (!dialogue.trim()) {
      setMessage('请先输入课堂对话。');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await diagnoseDialogue(dialogue, studentId, sessionId, state.knowledgeBase);
      setState((current) => ({
        ...current,
        diagnoses: [result, ...current.diagnoses],
      }));
      setSelectedDiagnosisId(result.id);
      setActiveTab('workspace');
      setMessage('诊断完成，结果已保存到本地。');
    } catch (error) {
      console.error(error);
      setMessage('诊断失败，请稍后再试。');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleTextUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      setDialogue(content);
      setMessage(`已导入文件：${file.name}`);
    } catch {
      setMessage('文件读取失败。');
    } finally {
      event.target.value = '';
    }
  }

  function handleVoiceInput() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setMessage('当前浏览器不支持语音录入，请使用 Chrome 或 Edge。');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Ctor();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setDialogue((current) => (current.trim() ? `${current}\n${transcript.trim()}` : transcript.trim()));
    };
    recognition.onerror = () => {
      setIsRecording(false);
      setMessage('语音识别中断，请重试。');
    };
    recognition.onend = () => {
      setIsRecording(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setMessage('语音录入已开始，再点一次可停止。');
  }

  function handleSaveChunk() {
    if (!chunkDraft.concept_name.trim() || !chunkDraft.chapter.trim() || !chunkDraft.content.trim()) {
      setMessage('知识条目的概念、章节和内容不能为空。');
      return;
    }

    const nextChunk: KnowledgeChunk = {
      id: editingChunkId || crypto.randomUUID(),
      last_updated: new Date().toISOString().slice(0, 10),
      ...chunkDraft,
      block_type: chunkDraft.block_type || undefined,
    };

    setState((current) => ({
      ...current,
      knowledgeBase: editingChunkId
        ? current.knowledgeBase.map((item) => (item.id === editingChunkId ? nextChunk : item))
        : [nextChunk, ...current.knowledgeBase],
    }));

    setEditingChunkId(null);
    setChunkDraft(emptyChunkDraft);
    setMessage(editingChunkId ? '知识条目已更新。' : '知识条目已新增。');
  }

  function handleEditChunk(chunk: KnowledgeChunk) {
    setEditingChunkId(chunk.id);
    setChunkDraft({
      concept_name: chunk.concept_name,
      chapter: chunk.chapter,
      grade: chunk.grade,
      content_category: chunk.content_category,
      block_type: chunk.block_type || '',
      source: chunk.source,
      constructed_by: chunk.constructed_by,
      review_status: chunk.review_status,
      content: chunk.content,
    });
  }

  function handleDeleteChunk(id: string) {
    setState((current) => ({
      ...current,
      knowledgeBase: current.knowledgeBase.filter((item) => item.id !== id),
    }));
    setMessage('知识条目已删除。');
  }

  function handleSaveEvaluation() {
    if (!selectedDiagnosis) {
      setMessage('请先选择一条诊断记录。');
      return;
    }

    const weightedScore = Number(
      (
        evaluationDraft.concept_accuracy * 0.35 +
        evaluationDraft.block_identification * 0.3 +
        evaluationDraft.question_effectiveness * 0.25 +
        evaluationDraft.format_stability * 0.1
      ).toFixed(2),
    );

    const reviewSuggestion: EvaluationForm['review_suggestion'] =
      weightedScore < 2.6 ? 'manual_review' : weightedScore < 3.8 ? 'optimize' : 'pass';

    const nextEvaluation: LocalEvaluation = {
      ...evaluationDraft,
      id: crypto.randomUUID(),
      diagnosis_id: selectedDiagnosis.id,
      created_at: new Date().toISOString(),
      weighted_score: weightedScore,
      review_suggestion: reviewSuggestion,
    };

    setState((current) => ({
      ...current,
      evaluations: [nextEvaluation, ...current.evaluations],
    }));
    setEvaluationDraft(emptyEvaluation);
    setMessage('人工评估已保存。');
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'workspace', label: '诊断工作台', icon: <Brain className="h-4 w-4" /> },
    { key: 'history', label: '历史记录', icon: <History className="h-4 w-4" /> },
    { key: 'knowledge', label: '知识库', icon: <BookOpen className="h-4 w-4" /> },
    { key: 'evaluation', label: '人工评估', icon: <Sparkles className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_26%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_48%,_#f8fafc_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.35)] backdrop-blur">
          <p className="text-sm font-medium text-blue-700">物理学情诊断前端 MVP</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">先把老师真正能用的前端流程跑起来</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            现在这版已经去掉前端 API key 暴露，支持文本上传、浏览器语音录入、本地诊断、知识库维护、历史记录和人工评估。
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-600 to-indigo-600 p-5 text-white">
              <p className="text-sm text-blue-100">累计诊断</p>
              <p className="mt-3 text-4xl font-semibold">{state.diagnoses.length}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">知识条目</p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">{state.knowledgeBase.length}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">人工评估</p>
              <p className="mt-3 text-4xl font-semibold text-slate-900">{state.evaluations.length}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">本地模式</p>
              <p className="mt-3 text-xl font-semibold text-slate-900">已启用</p>
            </div>
          </div>
        </header>

        <div className="mb-6 flex flex-wrap gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'border-white/70 bg-white/80 text-slate-700 hover:border-blue-200 hover:text-blue-700'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {message && <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{message}</div>}

        {activeTab === 'workspace' && (
          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <section className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.28)] backdrop-blur">
              <h2 className="text-xl font-semibold text-slate-900">诊断输入区</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <input
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  placeholder="学生标识"
                />
                <input
                  value={sessionId}
                  onChange={(event) => setSessionId(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  placeholder="会话编号"
                />
              </div>

              <textarea
                value={dialogue}
                onChange={(event) => setDialogue(event.target.value)}
                className="mt-5 min-h-[320px] w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="粘贴师生对话，或使用下方的文本上传/语音录入。"
              />

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  文本上传
                </button>
                <button
                  onClick={handleVoiceInput}
                  disabled={!voiceSupported}
                  className={`inline-flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    !voiceSupported
                      ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                      : isRecording
                        ? 'border border-rose-200 bg-rose-50 text-rose-700'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {isRecording ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                  {isRecording ? '停止录音' : '语音录入'}
                </button>
                <button
                  onClick={() => setDialogue('')}
                  className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  清空
                </button>
                <button
                  onClick={() => void handleAnalyze()}
                  disabled={isAnalyzing}
                  className="inline-flex items-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                >
                  {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                  {isAnalyzing ? '诊断中...' : '开始诊断'}
                </button>
                <input ref={fileInputRef} type="file" accept=".txt,.md,.json,.csv" className="hidden" onChange={handleTextUpload} />
              </div>
            </section>

            <section className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.28)] backdrop-blur">
              <h2 className="text-xl font-semibold text-slate-900">结构化结果</h2>
              {selectedDiagnosis ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
                    <p className="text-sm text-blue-700">知识点定位</p>
                    <h3 className="mt-1 text-2xl font-semibold text-slate-900">{selectedDiagnosis.knowledge_point.concept}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{selectedDiagnosis.knowledge_point.standard_definition}</p>
                  </div>

                  <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4">
                    <p className="text-sm font-medium text-rose-700">思维阻滞点</p>
                    <p className="mt-2 text-sm font-semibold text-rose-900">{selectedDiagnosis.cognitive_block.type}</p>
                    <p className="mt-2 text-sm leading-6 text-rose-800">{selectedDiagnosis.cognitive_block.description}</p>
                  </div>

                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-sm font-medium text-emerald-700">引导问题建议</p>
                    <div className="mt-3 space-y-2">
                      {selectedDiagnosis.guided_questions.map((question, index) => (
                        <div key={`${question}-${index}`} className="rounded-2xl bg-white/80 px-3 py-3 text-sm text-emerald-950">
                          {index + 1}. {question}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-medium text-slate-500">教学建议</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{selectedDiagnosis.teacher_recommendation}</p>
                    <p className="mt-3 text-xs text-slate-400">时间：{formatTime(selectedDiagnosis.created_at)}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-8 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center text-slate-500">
                  <FileText className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-4 text-sm">完成一次诊断后，结果会显示在这里。</p>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.28)] backdrop-blur">
              <h2 className="text-xl font-semibold text-slate-900">诊断历史</h2>
              <div className="mt-5 space-y-3">
                {state.diagnoses.length === 0 && <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">暂无历史记录。</div>}
                {state.diagnoses.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedDiagnosisId(item.id)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      selectedDiagnosis?.id === item.id ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.student_id}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.session_id}</p>
                    <p className="mt-2 text-sm text-slate-600">{item.knowledge_point.concept}</p>
                  </button>
                ))}
              </div>
            </section>
            <section className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.28)] backdrop-blur">
              {selectedDiagnosis ? (
                <>
                  <h2 className="text-xl font-semibold text-slate-900">原始对话</h2>
                  <pre className="mt-5 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{selectedDiagnosis.dialogue}</pre>
                </>
              ) : (
                <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">选择一条记录查看详情。</div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <section className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.28)] backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">{editingChunkId ? '编辑知识条目' : '新增知识条目'}</h2>
                <button
                  onClick={() => {
                    setEditingChunkId(null);
                    setChunkDraft(emptyChunkDraft);
                  }}
                  className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  新建
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <input
                  value={chunkDraft.concept_name}
                  onChange={(event) => setChunkDraft((current) => ({ ...current, concept_name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="概念名称"
                />
                <input
                  value={chunkDraft.chapter}
                  onChange={(event) => setChunkDraft((current) => ({ ...current, chapter: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="章节"
                />
                <textarea
                  value={chunkDraft.content}
                  onChange={(event) => setChunkDraft((current) => ({ ...current, content: event.target.value }))}
                  className="min-h-[220px] w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 outline-none"
                  placeholder="知识内容"
                />
                <button
                  onClick={handleSaveChunk}
                  className="inline-flex items-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {editingChunkId ? '保存修改' : '新增条目'}
                </button>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.28)] backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-slate-900">知识库列表</h2>
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={knowledgeQuery}
                    onChange={(event) => setKnowledgeQuery(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none sm:w-72"
                    placeholder="搜索概念、章节或内容"
                  />
                </label>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {filteredKnowledge.map((chunk) => (
                  <article key={chunk.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-base font-semibold text-slate-900">{chunk.concept_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{chunk.chapter}</p>
                    <p className="mt-1 text-xs text-slate-400">{chunk.content_category}</p>
                    <pre className="mt-4 line-clamp-6 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-700">{chunk.content}</pre>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleEditChunk(chunk)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteChunk(chunk.id)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                      >
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'evaluation' && (
          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <section className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.28)] backdrop-blur">
              <h2 className="text-xl font-semibold text-slate-900">人工评估录入</h2>
              <div className="mt-5 space-y-4">
                {[
                  ['concept_accuracy', '知识点识别准确性'],
                  ['block_identification', '阻滞点定位合理性'],
                  ['question_effectiveness', '引导问题有效性'],
                  ['format_stability', '输出格式稳定性'],
                ].map(([field, label]) => (
                  <div key={field}>
                    <p className="mb-2 text-sm font-medium text-slate-700">{label}</p>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          onClick={() =>
                            setEvaluationDraft((current) => ({
                              ...current,
                              [field]: value,
                            }))
                          }
                          className={`rounded-2xl border px-4 py-2 text-sm font-medium ${
                            evaluationDraft[field as keyof EvaluationForm] === value
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          {value} 分
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <textarea
                  value={evaluationDraft.key_issues}
                  onChange={(event) => setEvaluationDraft((current) => ({ ...current, key_issues: event.target.value }))}
                  className="min-h-[140px] w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 outline-none"
                  placeholder="主要问题说明"
                />

                <button
                  onClick={handleSaveEvaluation}
                  className="inline-flex items-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white"
                >
                  <Save className="mr-2 h-4 w-4" />
                  保存评估
                </button>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.28)] backdrop-blur">
              <h2 className="text-xl font-semibold text-slate-900">评估记录</h2>
              <div className="mt-5 space-y-3">
                {state.evaluations.length === 0 && <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">暂无评估记录。</div>}
                {state.evaluations.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">{formatTime(item.created_at)}</p>
                    <p className="mt-2 text-sm text-slate-700">综合得分：{item.weighted_score}</p>
                    <p className="mt-1 text-xs text-slate-500">建议：{item.review_suggestion}</p>
                    {item.key_issues && <p className="mt-2 text-sm text-slate-600">{item.key_issues}</p>}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
