import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  History,
  Home,
  LayoutList,
  Lightbulb,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Music,
  Network,
  Plus,
  Search,
  Settings,
  Target,
  ThumbsUp,
  TrendingDown,
  Upload,
  Waypoints,
  X,
} from 'lucide-react';
import { diagnoseDialogue } from './services/diagnosisService';
import { initialKnowledgeBase } from './store/kbStore';
import { DiagnosisResult, EvaluationForm, KnowledgeChunk } from './types';

type SpeechRecognitionCtor = new () => SpeechRecognition;
type SavedEvaluation = EvaluationForm & { id: string; diagnosisId: string; createdAt: string };
type AppStorage = {
  diagnoses: DiagnosisResult[];
  evaluations: SavedEvaluation[];
  knowledgeBase: KnowledgeChunk[];
};

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

const STORAGE_KEY = 'physics-visual-mvp';
const GUIDE_KEY = 'physics-visual-mvp-entry-guide-dismissed';

const levelLabel = (level: DiagnosisResult['mastery_assessment']['level']) =>
  level === 'generative'
    ? '生成性理解'
    : level === 'functional'
      ? '功能性理解'
      : level === 'surface'
        ? '表层理解'
        : level === 'misconception'
          ? '存在误概念'
          : '证据不足';

const scoreValue = (result: DiagnosisResult | null) =>
  !result
    ? 0
    : result.mastery_assessment.level === 'generative'
      ? 88
      : result.mastery_assessment.level === 'functional'
        ? 76
        : result.mastery_assessment.level === 'surface'
          ? 62
          : result.mastery_assessment.level === 'misconception'
            ? 41
            : 28;

const defaultEvaluation = (): EvaluationForm => ({
  concept_accuracy: 4,
  block_identification: 4,
  question_effectiveness: 4,
  format_stability: 4,
  weighted_score: 80,
  review_suggestion: 'pass',
  key_issues: '',
});

const defaultKnowledgeDraft = (): Omit<KnowledgeChunk, 'id' | 'last_updated'> => ({
  concept_name: '',
  chapter: '',
  grade: '八年级下',
  content_category: 'guidance_strategy',
  block_type: '',
  source: '教师补充',
  constructed_by: '本地用户',
  review_status: 'pending',
  content: '',
});

const suggestionLabel: Record<EvaluationForm['review_suggestion'], string> = {
  pass: '可直接使用',
  optimize: '建议优化',
  manual_review: '需要复核',
};

const categoryLabel: Record<KnowledgeChunk['content_category'], string> = {
  concept_definition: '概念定义',
  misconception: '误概念',
  guidance_strategy: '引导策略',
};

const setDialogue = (_value: string) => {};
const setStudentId = (_value: string) => {};
const setSessionId = (_value: string) => {};
const setMessage = (_value: string) => {};

const demoScenarios = [
  {
    id: 'inertia',
    label: '惯性误解',
    studentId: '小李',
    sessionSuffix: '001',
    dialogue:
      '学生：物体停下来是因为惯性消失了。\n老师：为什么这么说？\n学生：因为停下来就没有这个力了。',
  },
  {
    id: 'friction',
    label: '摩擦力方向',
    studentId: '小周',
    sessionSuffix: '002',
    dialogue:
      '学生：只要物体在运动，摩擦力就一定和它运动方向相反。\n老师：如果传送带带着箱子一起动呢？\n学生：那也应该反着吧。',
  },
  {
    id: 'pressure',
    label: '压强混淆',
    studentId: '小陈',
    sessionSuffix: '003',
    dialogue:
      '学生：压强就是压力大不大。\n老师：那受力面积会不会影响压强？\n学生：我觉得不会，主要看压得重不重。',
  },
  {
    id: 'circuit',
    label: '电流与电压',
    studentId: '小王',
    sessionSuffix: '004',
    dialogue:
      '学生：电压就是在电路里流来流去的东西。\n老师：那电流又是什么？\n学生：电流和电压应该差不多吧。',
  },
  {
    id: 'lens',
    label: '凸透镜成像',
    studentId: '小林',
    sessionSuffix: '005',
    dialogue:
      '学生：虚像也能在光屏上接到，只是有点模糊。\n老师：你为什么这么判断？\n学生：我觉得只要有像就能接到。',
  },
];

function readStorage(): AppStorage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { diagnoses: [], evaluations: [], knowledgeBase: initialKnowledgeBase };
    }
    const parsed = JSON.parse(raw) as Partial<AppStorage> | DiagnosisResult[];
    if (Array.isArray(parsed)) {
      return { diagnoses: parsed, evaluations: [], knowledgeBase: initialKnowledgeBase };
    }
    return {
      diagnoses: parsed.diagnoses ?? [],
      evaluations: parsed.evaluations ?? [],
      knowledgeBase: parsed.knowledgeBase?.length ? parsed.knowledgeBase : initialKnowledgeBase,
    };
  } catch {
    return { diagnoses: [], evaluations: [], knowledgeBase: initialKnowledgeBase };
  }
}

function ProgressBar({
  label,
  value,
  color,
  showValue = false,
}: {
  label: string;
  value: number;
  color: string;
  showValue?: boolean;
}) {
  function applyScenario(scenario: (typeof demoScenarios)[number]) {
    setDialogue(scenario.dialogue);
    setStudentId(scenario.studentId);
    setSessionId(
      `PHY_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_${scenario.sessionSuffix}`,
    );
    setMessage(`已切换到示例：${scenario.label}`);
  }

  const handleApplyScenario = (scenario: (typeof demoScenarios)[number]) => {
    setDialogue(scenario.dialogue);
    setStudentId(scenario.studentId);
    setSessionId(
      `PHY_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_${scenario.sessionSuffix}`,
    );
    setMessage(`已切换到示例：${scenario.label}`);
  };

  return (
    <div className="flex items-center text-sm">
      <span className="w-20 font-medium text-slate-600">{label}</span>
      {showValue ? (
        <>
          <div className="mx-3 h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
          </div>
          <span className="w-10 text-right font-medium text-slate-500">{value}%</span>
        </>
      ) : (
        <div className="ml-3 flex flex-1 items-center">
          <div className="flex space-x-1">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className={`h-3 w-3 rounded-sm ${item * 20 <= value ? color : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <span className="ml-3 text-xs text-slate-400">{value}%</span>
        </div>
      )}
    </div>
  );
}

function AtomAnimation({ isAnalyzing }: { isAnalyzing: boolean }) {
  return (
    <div className={`relative flex h-64 w-64 items-center justify-center transition-transform duration-1000 ${isAnalyzing ? 'scale-110' : 'scale-100'}`} style={{ perspective: '800px' }}>
      <div className={`absolute z-10 h-12 w-12 rounded-full bg-gradient-to-br from-red-400 to-rose-600 shadow-[0_0_40px_rgba(244,63,94,0.6)] ${isAnalyzing ? 'animate-pulse' : ''}`} />
      {['20deg', '80deg', '140deg'].map((deg, index) => (
        <div key={deg} className={`absolute h-full w-full rounded-full border ${index === 0 ? 'animate-spin-orbit border-blue-300/50' : index === 1 ? 'animate-spin-orbit-slow border-indigo-300/50' : 'animate-spin-orbit-reverse border-purple-300/50'}`} style={{ transformStyle: 'preserve-3d', ['--ry' as string]: deg }}>
          <div className={`absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-indigo-500' : 'bg-purple-500'}`} style={{ transform: 'rotateX(-90deg)' }} />
        </div>
      ))}
    </div>
  );
}

function weightedScore(form: EvaluationForm) {
  return Math.round((form.concept_accuracy * 30 + form.block_identification * 25 + form.question_effectiveness * 25 + form.format_stability * 20) / 5);
}

function suggestionFromScore(score: number): EvaluationForm['review_suggestion'] {
  if (score >= 85) return 'pass';
  if (score >= 65) return 'optimize';
  return 'manual_review';
}

function dismissFeatureGuide(setter: (value: boolean) => void) {
  setter(false);
  localStorage.setItem(GUIDE_KEY, '1');
}

export default function App() {
  const initial = useMemo(readStorage, []);
  const [dialogue, setDialogue] = useState('学生：物体停下来是因为惯性消失了。\n老师：为什么这么说？\n学生：因为停下来就没有这个力了。');
  const [studentId, setStudentId] = useState('小李');
  const [sessionId, setSessionId] = useState(`PHY_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_001`);
  const [diagnoses, setDiagnoses] = useState<DiagnosisResult[]>(initial.diagnoses);
  const [evaluations, setEvaluations] = useState<SavedEvaluation[]>(initial.evaluations);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeChunk[]>(initial.knowledgeBase);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showReportPrompt, setShowReportPrompt] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showFeatureGuide, setShowFeatureGuide] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeDraft, setKnowledgeDraft] = useState<Omit<KnowledgeChunk, 'id' | 'last_updated'>>(defaultKnowledgeDraft);
  const [evaluationDraft, setEvaluationDraft] = useState<EvaluationForm>(defaultEvaluation);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ diagnoses, evaluations, knowledgeBase }));
  }, [diagnoses, evaluations, knowledgeBase]);

  useEffect(() => {
    setVoiceSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    const dismissed = localStorage.getItem(GUIDE_KEY);
    if (dismissed === '1') {
      return undefined;
    }

    const showTimer = window.setTimeout(() => setShowFeatureGuide(true), 900);
    const hideTimer = window.setTimeout(() => {
      setShowFeatureGuide(false);
      localStorage.setItem(GUIDE_KEY, '1');
    }, 9000);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const selected = useMemo(
    () => (selectedId ? diagnoses.find((item) => item.id === selectedId) ?? null : null),
    [diagnoses, selectedId],
  );

  const selectedEvaluation = useMemo(
    () => evaluations.find((item) => item.diagnosisId === selected?.id) ?? null,
    [evaluations, selected],
  );

  const score = scoreValue(selected);

  const filteredKnowledge = useMemo(() => {
    const query = knowledgeQuery.trim().toLowerCase();
    if (!query) return knowledgeBase;
    return knowledgeBase.filter((item) =>
      [item.concept_name, item.chapter, item.content, item.source].some((field) =>
        field.toLowerCase().includes(query),
      ),
    );
  }, [knowledgeBase, knowledgeQuery]);

  const knowledgeOverview = useMemo(() => {
    const chapterSet = new Set<string>();
    const conceptMap = new Map<
      string,
      {
        concept: string;
        chapter: string;
        grade: string;
        categories: Set<KnowledgeChunk['content_category']>;
        snippets: Partial<Record<KnowledgeChunk['content_category'], string>>;
        sources: Set<string>;
        updatedAt: string;
      }
    >();

    knowledgeBase.forEach((item) => {
      chapterSet.add(item.chapter);
      const current = conceptMap.get(item.concept_name) ?? {
        concept: item.concept_name,
        chapter: item.chapter,
        grade: item.grade,
        categories: new Set<KnowledgeChunk['content_category']>(),
        snippets: {},
        sources: new Set<string>(),
        updatedAt: item.last_updated,
      };

      current.categories.add(item.content_category);
      current.sources.add(item.source);
      current.updatedAt = current.updatedAt > item.last_updated ? current.updatedAt : item.last_updated;
      if (!current.snippets[item.content_category]) {
        current.snippets[item.content_category] = item.content;
      }
      conceptMap.set(item.concept_name, current);
    });

    const query = knowledgeQuery.trim().toLowerCase();
    const concepts = Array.from(conceptMap.values())
      .filter((item) => {
        if (!query) return true;
        return [
          item.concept,
          item.chapter,
          item.grade,
          ...Object.values(item.snippets).filter(Boolean),
          ...Array.from(item.sources),
        ].some((field) => field.toLowerCase().includes(query));
      })
      .sort(
        (left, right) =>
          left.chapter.localeCompare(right.chapter, 'zh-CN') ||
          left.concept.localeCompare(right.concept, 'zh-CN'),
      );

    return {
      chapterCount: chapterSet.size,
      conceptCount: conceptMap.size,
      entryCount: knowledgeBase.length,
      concepts,
    };
  }, [knowledgeBase, knowledgeQuery]);

  const socraticQuestions = useMemo(
    () => (selected ? selected.guided_questions.slice(0, 3) : []),
    [selected],
  );

  useEffect(() => {
    if (!showEvaluation) return;
    if (!selectedEvaluation) {
      setEvaluationDraft(defaultEvaluation());
      return;
    }
    setEvaluationDraft({
      concept_accuracy: selectedEvaluation.concept_accuracy,
      block_identification: selectedEvaluation.block_identification,
      question_effectiveness: selectedEvaluation.question_effectiveness,
      format_stability: selectedEvaluation.format_stability,
      weighted_score: selectedEvaluation.weighted_score,
      review_suggestion: selectedEvaluation.review_suggestion,
      key_issues: selectedEvaluation.key_issues,
    });
  }, [selectedEvaluation, showEvaluation]);

  async function handleAnalyze() {
    if (!dialogue.trim()) {
      setMessage('请先输入课堂对话内容。');
      return;
    }
    setIsAnalyzing(true);
    setShowReportPrompt(false);
    setAnalysisStep(1);
    window.setTimeout(() => setAnalysisStep(2), 700);
    window.setTimeout(() => setAnalysisStep(3), 1400);
    try {
      const result = await diagnoseDialogue(dialogue, studentId, sessionId, knowledgeBase);
      setDiagnoses((current) => [result, ...current]);
      setSelectedId(result.id);
      setIsAnalyzing(false);
      window.setTimeout(() => setShowReportPrompt(true), 3000);
      setMessage('已生成新的引导问题与学情判断。');
    } catch {
      setIsAnalyzing(false);
      setAnalysisStep(0);
      setMessage('诊断失败，请稍后重试。');
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setDialogue(await file.text());
    setMessage(`已导入文件：${file.name}`);
    event.target.value = '';
  }

  function handleVoice() {
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
      let text = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        text += event.results[index][0].transcript;
      }
      if (!text.trim()) return;
      setDialogue((current) => (current.trim() ? `${current}\n${text.trim()}` : text.trim()));
    };
    recognition.onerror = () => {
      setIsRecording(false);
      setMessage('语音识别被中断，请重试。');
    };
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setMessage('语音录入已开始，再点一次即可停止。');
  }

  function saveKnowledgeItem() {
    if (!knowledgeDraft.concept_name.trim() || !knowledgeDraft.content.trim()) {
      setMessage('请先填写知识点名称和内容。');
      return;
    }
    const item: KnowledgeChunk = {
      ...knowledgeDraft,
      id: `kb_local_${Date.now()}`,
      last_updated: new Date().toISOString().slice(0, 10),
      concept_name: knowledgeDraft.concept_name.trim(),
      chapter: knowledgeDraft.chapter.trim() || '未分类章节',
      block_type: knowledgeDraft.block_type?.trim() || undefined,
      source: knowledgeDraft.source.trim() || '教师补充',
      constructed_by: knowledgeDraft.constructed_by.trim() || '本地用户',
      content: knowledgeDraft.content.trim(),
    };
    setKnowledgeBase((current) => [item, ...current]);
    setKnowledgeDraft(defaultKnowledgeDraft());
    setMessage('知识库条目已保存。');
  }

  function updateEvaluation<K extends keyof EvaluationForm>(key: K, value: EvaluationForm[K]) {
    const next = { ...evaluationDraft, [key]: value };
    const scoreResult = weightedScore(next);
    setEvaluationDraft({
      ...next,
      weighted_score: scoreResult,
      review_suggestion: suggestionFromScore(scoreResult),
    });
  }

  function saveEvaluation() {
    if (!selected) {
      setMessage('请先选择一条诊断记录。');
      return;
    }
    const payload: SavedEvaluation = {
      id: selectedEvaluation?.id ?? `eval_${Date.now()}`,
      diagnosisId: selected.id,
      createdAt: new Date().toISOString(),
      ...evaluationDraft,
    };
    setEvaluations((current) => [
      payload,
      ...current.filter((item) => item.diagnosisId !== selected.id),
    ]);
    setShowEvaluation(false);
    setMessage('人工评估已保存。');
  }

  function handleApplyScenario(scenario: (typeof demoScenarios)[number]) {
    setDialogue(scenario.dialogue);
    setStudentId(scenario.studentId);
    setSessionId(
      `PHY_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_${scenario.sessionSuffix}`,
    );
    setMessage(`已切换到示例：${scenario.label}`);
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50 font-sans">
      <nav className="relative z-10 flex h-14 items-center justify-between border-b border-blue-100/50 bg-[#F5F9FF] px-6">
        <div className="flex items-center text-sm font-medium text-slate-600">
          <button className="flex items-center transition-colors hover:text-blue-600">
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </button>
          <span className="mx-4 text-slate-300">|</span>
          <span className="font-semibold text-slate-800">物理学情分析中心</span>
        </div>
        <div className="flex items-center space-x-4 text-sm text-slate-600">
          <button onClick={() => setShowHistory(true)} className="transition-colors hover:text-blue-600">
            历史
          </button>
          <span className="text-slate-300">·</span>
          <button onClick={() => setShowReport(true)} disabled={!selected} className="transition-colors hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40">
            学情报告
          </button>
        </div>
      </nav>

      <div className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#f8faff] via-[#f0f5ff] to-[#f5f3ff]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] animate-pulse rounded-full bg-blue-200/30 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] animate-pulse rounded-full bg-purple-200/30 blur-3xl" style={{ animationDelay: '2s' }} />
          <div className="absolute right-[20%] top-[20%] h-[20%] w-[20%] animate-pulse rounded-full bg-indigo-200/20 blur-3xl" style={{ animationDelay: '4s' }} />
        </div>

        <div className="relative mx-auto mb-16 mt-8 flex min-h-0 w-full max-w-6xl flex-1 flex-col rounded-3xl border border-white bg-white/90 p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] backdrop-blur-xl">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
                <Home className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-800">初中物理学情分析</h1>
            </div>
            <div className="flex space-x-2">
              <div className="h-3 w-3 rounded-full bg-amber-400" />
              <div className="h-3 w-3 rounded-full bg-blue-400" />
              <div className="h-3 w-3 rounded-full bg-purple-400" />
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex flex-col space-y-6">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <h2 className="mb-3 flex items-center text-sm font-semibold text-slate-700"><MessageSquare className="mr-2 h-4 w-4 text-blue-500" />对话内容录入</h2>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <input value={studentId} onChange={(event) => setStudentId(event.target.value)} className="w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm outline-none" placeholder="学生姓名/编号" />
                  <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} className="w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm outline-none" placeholder="会话编号" />
                </div>
                <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Demo</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">一键切换演示示例</p>
                    </div>
                    <p className="text-xs text-slate-500">不同知识点可直接切换</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {demoScenarios.map((scenario) => (
                      <button
                        key={scenario.id}
                        onClick={() => handleApplyScenario(scenario)}
                        className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-100/80"
                      >
                        {scenario.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea value={dialogue} onChange={(event) => setDialogue(event.target.value)} className="h-40 w-full resize-none rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm outline-none" placeholder="请输入或粘贴老师与学生的问答内容..." />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"><Upload className="mr-1.5 h-3.5 w-3.5" />文本上传</button>
                  <button onClick={handleVoice} disabled={!voiceSupported} className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50">{isRecording ? <MicOff className="mr-1.5 h-3.5 w-3.5" /> : <Mic className="mr-1.5 h-3.5 w-3.5" />}{isRecording ? '停止录音' : '语音录入'}</button>
                  <input ref={fileInputRef} type="file" accept=".txt,.md,.json,.csv" className="hidden" onChange={handleUpload} />
                </div>
                <div className="mt-4 flex space-x-3">
                  <button onClick={() => void handleAnalyze()} disabled={isAnalyzing} className="flex flex-1 items-center justify-center rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400">{isAnalyzing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}{isAnalyzing ? '分析中...' : '开始分析学情'}</button>
                  <button onClick={() => setDialogue('')} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200">清空</button>
                </div>
              </div>
              <div className="relative flex min-h-[220px] flex-1 items-center justify-center">
                <AtomAnimation isAnalyzing={isAnalyzing} />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs text-slate-400">{message ?? `已保存诊断 ${diagnoses.length} 条`}</div>
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-center text-sm font-semibold text-slate-700">AI 智能解析</h2>
              <div className="mb-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Live Status</p>
                    <p className="mt-1 text-base font-bold text-slate-900">
                      {isAnalyzing ? '正在构建诊断链路' : selected ? '已完成本轮智能解析' : '等待开始分析'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selected?.diagnostic_summary ?? '点击开始分析后，系统会逐步识别知识点、阻滞点并生成追问。'}
                    </p>
                  </div>
                  <div className="relative">
                    <Network className={`h-10 w-10 ${isAnalyzing ? 'animate-pulse text-blue-500' : 'text-slate-300'}`} />
                    {isAnalyzing && <div className="absolute inset-0 animate-ping rounded-full border-2 border-blue-400 opacity-20" />}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">当前焦点</p>
                    <p className="mt-2 text-base font-bold text-slate-900">{selected?.knowledge_point.concept ?? '等待识别知识点'}</p>
                    <p className="mt-1 text-xs text-slate-500">{selected?.knowledge_point.chapter ?? '分析开始后，这里会出现系统判断的章节归属。'}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">当前判断</p>
                    <p className="mt-2 text-base font-bold text-slate-900">{selected ? levelLabel(selected.mastery_assessment.level) : '等待掌握层级'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {selected?.mastery_assessment.level_description ?? '分析完成后，这里会显示当前理解层级和简要说明。'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 w-full">
                <div className="w-full space-y-4">
                  <h3 className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-slate-400">知识点识别与问题提取</h3>
                  <div className={`flex items-center rounded-xl p-3 transition-all duration-500 ${analysisStep >= 1 ? 'scale-[1.01] border border-emerald-100 bg-emerald-50 shadow-sm shadow-emerald-100/80' : 'bg-slate-50 opacity-70'}`}><div className={`mr-3 flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-500 ${analysisStep >= 1 ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400'}`}><CheckCircle2 className={`h-5 w-5 ${analysisStep >= 1 ? 'animate-pulse' : ''}`} /></div><div className="flex-1"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-800">识别知识点</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-all duration-500 ${analysisStep >= 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{analysisStep >= 1 ? '已完成' : '等待中'}</span></div><p className="mt-1 text-xs text-slate-500">{selected?.knowledge_point.concept ?? '从学生表达中定位核心物理概念'}</p></div></div>
                  <div className={`flex items-center rounded-xl p-3 transition-all duration-500 ${analysisStep >= 2 ? 'scale-[1.01] border border-amber-100 bg-amber-50 shadow-sm shadow-amber-100/80' : 'bg-slate-50 opacity-70'}`}><div className={`mr-3 flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-500 ${analysisStep >= 2 ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-400'}`}><AlertTriangle className={`h-5 w-5 ${analysisStep >= 2 ? 'animate-pulse' : ''}`} /></div><div className="flex-1"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-800">识别阻滞点</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-all duration-500 ${analysisStep >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>{analysisStep >= 2 ? '已完成' : '等待中'}</span></div><p className="mt-1 text-xs text-slate-500">{selected?.cognitive_block.type ?? '判断是概念混淆、条件遗漏还是表层理解'}</p></div></div>
                  <div className={`flex items-center rounded-xl p-3 transition-all duration-500 ${analysisStep >= 3 ? 'scale-[1.01] border border-indigo-100 bg-indigo-50 shadow-sm shadow-indigo-100/80' : 'bg-slate-50 opacity-70'}`}><div className={`mr-3 flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-500 ${analysisStep >= 3 ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-slate-400'}`}><Target className={`h-5 w-5 ${analysisStep >= 3 ? 'animate-pulse' : ''}`} /></div><div className="flex-1"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-800">生成引导建议</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-all duration-500 ${analysisStep >= 3 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>{analysisStep >= 3 ? '已完成' : '等待中'}</span></div><p className="mt-1 text-xs text-slate-500">{selected ? `${selected.guided_questions.length} 个苏格拉底式追问已准备` : '生成 2 到 3 个纠偏式引导问题'}</p></div></div>
                </div>
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">苏格拉底式提问</h2>
                <button onClick={() => setShowReport(true)} disabled={!selected} className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50">学情报告</button>
              </div>
              <div className="flex flex-1 flex-col justify-between">
                {selected ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">当前聚焦知识点</p>
                      <p className="mt-2 text-lg font-bold text-slate-800">{selected.knowledge_point.concept}</p>
                      <p className="mt-1 text-sm text-slate-500">{selected.knowledge_point.chapter}</p>
                    </div>
                    <div className="space-y-3">
                      {socraticQuestions.map((question, index) => (
                        <div key={`${question}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start">
                            <div className="mr-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">{index + 1}</div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">引导问题</p>
                              <p className="mt-1 text-sm leading-relaxed text-slate-700">{question}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                      <p className="flex items-center text-sm font-semibold text-amber-800"><Lightbulb className="mr-2 h-4 w-4" />提问思路</p>
                      <p className="mt-2 text-sm leading-relaxed text-amber-700">先追问学生当前判断的依据，再让他用反例或新情境自我修正，最后要求学生重新复述正确概念。</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-center opacity-40">
                    <Waypoints className="mb-4 h-16 w-16 text-slate-400" />
                    <p className="text-sm text-slate-500">完成诊断后，这里会出现 2 到 3 个引导问题。</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="absolute bottom-4 left-0 right-0 text-center text-xs text-slate-400">2026 初中物理学情分析系统</footer>
      </div>

      {showReportPrompt && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowReportPrompt(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-indigo-500">分析完成</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">是否查看学情报告？</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  本次已识别到“{selected.knowledge_point.concept}”，并生成了对应的苏格拉底式引导问题。
                </p>
              </div>
              <button
                onClick={() => setShowReportPrompt(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
              <p className="text-sm font-semibold text-slate-800">{selected.knowledge_point.chapter}</p>
              <p className="mt-1 text-sm text-slate-600">{selected.diagnostic_summary}</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowReportPrompt(false)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
              >
                暂不查看
              </button>
              <button
                onClick={() => {
                  setShowReportPrompt(false);
                  setShowReport(true);
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                打开学情报告
              </button>
            </div>
          </div>
        </div>
      )}

      {showReport && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowReport(false)} />
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4">
              <h2 className="flex items-center text-lg font-bold text-slate-800"><FileText className="mr-2 h-5 w-5 text-blue-600" />详细学情分析报告</h2>
              <button onClick={() => setShowReport(false)} className="p-2 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-8 overflow-y-auto p-6">
              <div className="flex flex-col items-center gap-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm md:flex-row">
                <div className="text-center md:border-r md:border-slate-100 md:pr-8"><p className="mb-1 text-sm font-medium text-slate-500">总体掌握评分</p><div className="bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-5xl font-black text-transparent">{score}</div></div>
                <div className="w-full flex-1 space-y-4"><ProgressBar label="概念理解" value={score} color="bg-blue-500" showValue /><ProgressBar label="问题识别" value={Math.max(36, score - 5)} color="bg-amber-500" showValue /><ProgressBar label="引导设计" value={Math.min(95, score + 10)} color="bg-emerald-500" showValue /></div>
              </div>
              <div>
                <h3 className="mb-4 flex items-center text-base font-bold text-slate-800"><LayoutList className="mr-2 h-4 w-4 text-indigo-500" />诊断结果总览</h3>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 font-medium text-slate-600"><tr><th className="border-b border-slate-200 px-4 py-3">项目</th><th className="border-b border-slate-200 px-4 py-3">结果</th><th className="border-b border-slate-200 px-4 py-3">说明</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr><td className="px-4 py-3 font-medium text-slate-800">知识点</td><td className="px-4 py-3">{selected.knowledge_point.concept}</td><td className="px-4 py-3 text-slate-600">{selected.knowledge_point.chapter}</td></tr>
                      <tr><td className="px-4 py-3 font-medium text-slate-800">掌握层级</td><td className="px-4 py-3">{levelLabel(selected.mastery_assessment.level)}</td><td className="px-4 py-3 text-slate-600">{selected.mastery_assessment.level_description}</td></tr>
                      <tr><td className="px-4 py-3 font-medium text-slate-800">阻滞点</td><td className="px-4 py-3">{selected.cognitive_block.type}</td><td className="px-4 py-3 text-slate-600">{selected.cognitive_block.description}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 className="mb-4 flex items-center text-base font-bold text-slate-800"><Lightbulb className="mr-2 h-4 w-4 text-amber-500" />思维组织与学习建议</h3>
                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4"><h4 className="mb-2 flex items-center text-sm font-bold text-emerald-800"><ThumbsUp className="mr-1.5 h-4 w-4" />当前可利用优势</h4><p className="text-sm leading-relaxed text-emerald-700">{selected.learning_status.engagement_level === 'high' ? '学生愿意持续表达和回应，适合通过追问逐步修正概念。' : '学生已有基础回应，适合通过更具体的反例帮助其建立稳定理解。'}</p></div>
                  <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4"><h4 className="mb-2 flex items-center text-sm font-bold text-rose-800"><TrendingDown className="mr-1.5 h-4 w-4" />当前核心不足</h4><p className="text-sm leading-relaxed text-rose-700">{selected.cognitive_block.root_cause}</p></div>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
                  <h4 className="mb-3 flex items-center text-sm font-bold text-indigo-800"><Target className="mr-1.5 h-4 w-4" />针对性引导建议</h4>
                  <ul className="space-y-2">{selected.guided_questions.map((text, index) => <li key={`${text}-${index}`} className="flex items-start text-sm text-indigo-900"><span className="mt-0.5 mr-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-200 text-xs font-bold text-indigo-700">{index + 1}</span><span className="leading-relaxed">{text}</span></li>)}</ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHistory && <div className="fixed inset-0 z-50 flex items-center justify-end p-4"><div className="absolute inset-0 bg-slate-900/30" onClick={() => setShowHistory(false)} /><div className="relative h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h3 className="flex items-center text-lg font-bold text-slate-800"><History className="mr-2 h-5 w-5 text-blue-600" />诊断历史</h3><button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button></div><div className="space-y-3">{diagnoses.map((item) => <button key={item.id} onClick={() => { setSelectedId(item.id); setShowHistory(false); }} className="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"><p className="font-medium text-slate-800">{item.student_id}</p><p className="mt-1 text-xs text-slate-500">{item.session_id}</p><p className="mt-3 text-sm text-slate-600">{item.knowledge_point.concept}</p></button>)}{diagnoses.length === 0 && <p className="text-sm text-slate-500">还没有保存的诊断记录。</p>}</div></div></div>}

      {showKnowledge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowKnowledge(false)}
          />
          <div className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-sky-50 to-indigo-50 px-6 py-4">
              <div>
                <h2 className="flex items-center text-lg font-bold text-slate-800">
                  <Settings className="mr-2 h-5 w-5 text-blue-600" />
                  知识库管理
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  当前诊断优先参考这里的章节覆盖、误概念样例和引导策略。
                </p>
              </div>
              <button
                onClick={() => setShowKnowledge(false)}
                className="p-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[0.95fr_1.45fr]">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                    <p className="text-xs font-medium text-blue-600">覆盖章节</p>
                    <div className="mt-2 text-2xl font-black text-slate-900">
                      {knowledgeOverview.chapterCount}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                    <p className="text-xs font-medium text-indigo-600">知识点数</p>
                    <div className="mt-2 text-2xl font-black text-slate-900">
                      {knowledgeOverview.conceptCount}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                    <p className="text-xs font-medium text-amber-600">条目总数</p>
                    <div className="mt-2 text-2xl font-black text-slate-900">
                      {knowledgeOverview.entryCount}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">新增知识条目</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      可以继续补充你的教材表达、课堂错例和追问策略。
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    <input
                      value={knowledgeDraft.concept_name}
                      onChange={(event) =>
                        setKnowledgeDraft((current) => ({ ...current, concept_name: event.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                      placeholder="知识点名称"
                    />
                    <input
                      value={knowledgeDraft.chapter}
                      onChange={(event) =>
                        setKnowledgeDraft((current) => ({ ...current, chapter: event.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                      placeholder="所属章节"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={knowledgeDraft.content_category}
                        onChange={(event) =>
                          setKnowledgeDraft((current) => ({
                            ...current,
                            content_category: event.target.value as KnowledgeChunk['content_category'],
                          }))
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                      >
                        <option value="concept_definition">概念定义</option>
                        <option value="misconception">误概念</option>
                        <option value="guidance_strategy">引导策略</option>
                      </select>
                      <input
                        value={knowledgeDraft.block_type}
                        onChange={(event) =>
                          setKnowledgeDraft((current) => ({ ...current, block_type: event.target.value }))
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                        placeholder="阻滞类型，可选"
                      />
                    </div>
                    <textarea
                      value={knowledgeDraft.content}
                      onChange={(event) =>
                        setKnowledgeDraft((current) => ({ ...current, content: event.target.value }))
                      }
                      className="h-40 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                      placeholder="可直接粘贴概念解释、误概念示例或教学策略。"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={knowledgeDraft.source}
                        onChange={(event) =>
                          setKnowledgeDraft((current) => ({ ...current, source: event.target.value }))
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                        placeholder="来源"
                      />
                      <input
                        value={knowledgeDraft.constructed_by}
                        onChange={(event) =>
                          setKnowledgeDraft((current) => ({
                            ...current,
                            constructed_by: event.target.value,
                          }))
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                        placeholder="整理人"
                      />
                    </div>
                    <button
                      onClick={saveKnowledgeItem}
                      className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      保存到知识库
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">知识点覆盖总览</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      这里按知识点聚合展示，更适合演示当前系统已经覆盖到哪些物理内容。
                    </p>
                  </div>
                  <input
                    value={knowledgeQuery}
                    onChange={(event) => setKnowledgeQuery(event.target.value)}
                    className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                    placeholder="搜索知识点、章节或内容"
                  />
                </div>

                <div className="grid gap-4">
                  {knowledgeOverview.concepts.map((item) => (
                    <div
                      key={item.concept}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-lg font-semibold text-slate-900">{item.concept}</h4>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                              {item.chapter}
                            </span>
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-600">
                              {item.grade}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {Array.from(item.categories).map((category: KnowledgeChunk['content_category']) => (
                              <span
                                key={category}
                                className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-600"
                              >
                                {categoryLabel[category]}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-xs text-slate-400">更新：{item.updatedAt}</div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs font-semibold text-slate-500">概念定义</p>
                          <p className="mt-2 text-sm leading-relaxed text-slate-700">
                            {item.snippets.concept_definition ?? '暂无概念定义'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-rose-50/60 p-3">
                          <p className="text-xs font-semibold text-rose-500">常见误解</p>
                          <p className="mt-2 text-sm leading-relaxed text-slate-700">
                            {item.snippets.misconception ?? '暂无误概念条目'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-indigo-50/60 p-3">
                          <p className="text-xs font-semibold text-indigo-500">引导策略</p>
                          <p className="mt-2 text-sm leading-relaxed text-slate-700">
                            {item.snippets.guidance_strategy ?? '暂无引导策略条目'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
                        <span>来源：{Array.from(item.sources).join('、')}</span>
                        <span>关联条目：{item.categories.size}</span>
                      </div>
                    </div>
                  ))}

                  {knowledgeOverview.concepts.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                      没有匹配的知识点，请换个关键词试试。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {false && showKnowledge && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"><div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowKnowledge(false)} /><div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-sky-50 to-indigo-50 px-6 py-4"><h2 className="flex items-center text-lg font-bold text-slate-800"><Settings className="mr-2 h-5 w-5 text-blue-600" />知识库管理</h2><button onClick={() => setShowKnowledge(false)} className="p-2 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button></div><div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[1.05fr_1.4fr]"><div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-5"><div><h3 className="text-base font-bold text-slate-800">新增知识条目</h3><p className="mt-1 text-sm text-slate-500">把你现有教案里的概念定义、误概念和引导策略补进来。</p></div><input value={knowledgeDraft.concept_name} onChange={(event) => setKnowledgeDraft((current) => ({ ...current, concept_name: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none" placeholder="知识点名称" /><input value={knowledgeDraft.chapter} onChange={(event) => setKnowledgeDraft((current) => ({ ...current, chapter: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none" placeholder="所属章节" /><div className="grid grid-cols-2 gap-3"><select value={knowledgeDraft.content_category} onChange={(event) => setKnowledgeDraft((current) => ({ ...current, content_category: event.target.value as KnowledgeChunk['content_category'] }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"><option value="concept_definition">概念定义</option><option value="misconception">误概念</option><option value="guidance_strategy">引导策略</option></select><input value={knowledgeDraft.block_type} onChange={(event) => setKnowledgeDraft((current) => ({ ...current, block_type: event.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none" placeholder="阻滞类型，可选" /></div><textarea value={knowledgeDraft.content} onChange={(event) => setKnowledgeDraft((current) => ({ ...current, content: event.target.value }))} className="h-40 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none" placeholder="可直接粘贴概念解释、误概念示例或教学策略。" /><div className="grid grid-cols-2 gap-3"><input value={knowledgeDraft.source} onChange={(event) => setKnowledgeDraft((current) => ({ ...current, source: event.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none" placeholder="来源" /><input value={knowledgeDraft.constructed_by} onChange={(event) => setKnowledgeDraft((current) => ({ ...current, constructed_by: event.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none" placeholder="整理人" /></div><button onClick={saveKnowledgeItem} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700">保存到知识库</button></div><div className="space-y-4"><div className="flex items-center justify-between gap-4"><div><h3 className="text-base font-bold text-slate-800">现有知识库</h3><p className="mt-1 text-sm text-slate-500">诊断时会优先参考这里的概念和引导策略。</p></div><input value={knowledgeQuery} onChange={(event) => setKnowledgeQuery(event.target.value)} className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none" placeholder="搜索" /></div><div className="grid gap-3">{filteredKnowledge.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-slate-800">{item.concept_name}</h4><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-600">{categoryLabel[item.content_category]}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{item.chapter}</span></div><p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{item.content}</p><div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400"><span>来源：{item.source}</span><span>整理：{item.constructed_by}</span><span>更新：{item.last_updated}</span></div></div>)}{filteredKnowledge.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">没有匹配的知识条目。</div>}</div></div></div></div></div>}

      {showEvaluation && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"><div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowEvaluation(false)} /><div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-4"><h2 className="flex items-center text-lg font-bold text-slate-800"><Music className="mr-2 h-5 w-5 text-indigo-500" />人工评估</h2><button onClick={() => setShowEvaluation(false)} className="p-2 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button></div><div className="space-y-6 overflow-y-auto p-6"><div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5"><p className="text-sm text-slate-500">当前记录</p><h3 className="mt-1 text-lg font-bold text-slate-800">{selected ? `${selected.student_id} | ${selected.knowledge_point.concept}` : '暂无已选诊断'}</h3><p className="mt-2 text-sm text-slate-600">这一层用于老师复核 AI 诊断，确认概念判断、阻滞点识别和引导问题是否可用。</p></div><div className="grid gap-4 md:grid-cols-2">{[['concept_accuracy', '概念判断准确度'], ['block_identification', '阻滞点识别'], ['question_effectiveness', '引导问题有效性'], ['format_stability', '输出格式稳定性']].map(([key, label]) => <div key={key} className="rounded-2xl border border-slate-200 p-4"><p className="text-sm font-medium text-slate-700">{label}</p><div className="mt-3 flex gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} onClick={() => updateEvaluation(key as keyof EvaluationForm, value as never)} className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold transition ${evaluationDraft[key as keyof EvaluationForm] === value ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{value}</button>)}</div></div>)}</div><div className="rounded-2xl border border-slate-200 p-5"><div className="grid gap-4 md:grid-cols-[1fr_1fr]"><div><p className="text-sm text-slate-500">综合得分</p><div className="mt-2 text-4xl font-black text-slate-800">{evaluationDraft.weighted_score}</div></div><div><p className="text-sm text-slate-500">评估建议</p><div className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">{suggestionLabel[evaluationDraft.review_suggestion]}</div></div></div><textarea value={evaluationDraft.key_issues} onChange={(event) => updateEvaluation('key_issues', event.target.value)} className="mt-4 h-28 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none" placeholder="记录需要优化的问题，比如哪一条引导问题不够聚焦。" /></div><div className="flex justify-end gap-3"><button onClick={() => setShowEvaluation(false)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200">取消</button><button onClick={saveEvaluation} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">保存人工评估</button></div></div></div></div>}

      <div className="fixed bottom-28 right-6 z-40 flex flex-col items-end space-y-3">
        {showFeatureGuide && (
          <div className="max-w-[240px] rounded-2xl border border-blue-100 bg-white/95 px-4 py-3 text-right shadow-[0_18px_45px_rgba(59,130,246,0.18)] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">推荐查看</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">这里可以打开知识库管理</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  演示时可以直接展示系统已覆盖的章节、知识点和引导策略。
                </p>
              </div>
              <button
                onClick={() => dismissFeatureGuide(setShowFeatureGuide)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        <button
          onClick={() => setShowKnowledge(true)}
          className="group flex items-center gap-3 rounded-full border border-blue-100 bg-white/95 px-3 py-2 text-left shadow-[0_18px_45px_rgba(59,130,246,0.25)] ring-1 ring-blue-100/60 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(59,130,246,0.32)]"
        >
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/40">
            <span className="absolute inset-0 rounded-full bg-blue-400/40 animate-ping" />
            <Settings className="relative h-6 w-6" />
          </div>
          <div className="pr-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">入口</div>
            <div className="text-sm font-bold text-slate-900">知识库管理</div>
            <div className="text-xs text-slate-500">查看覆盖范围与新增条目</div>
          </div>
        </button>

        <button
          onClick={() => setShowHistory(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/40 transition-transform hover:scale-110"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
      <div className="fixed bottom-8 left-1/2 z-40 -translate-x-1/2">
        {showFeatureGuide && (
          <div className="mb-3 flex justify-center">
            <div className="max-w-[280px] rounded-2xl border border-indigo-100 bg-white/95 px-4 py-3 text-center shadow-[0_18px_45px_rgba(99,102,241,0.18)] backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">老师入口</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">人工评估可对诊断结果打分</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                适合演示“AI 输出后还有老师复核”这一层。
              </p>
            </div>
          </div>
        )}
        <button
          onClick={() => setShowEvaluation(true)}
          className="group flex items-center gap-3 rounded-full border border-indigo-100 bg-white/95 px-4 py-2 shadow-[0_18px_45px_rgba(99,102,241,0.2)] ring-1 ring-indigo-100/70 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(99,102,241,0.28)]"
        >
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
            <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              老师
            </span>
            <Music className="h-5 w-5" />
          </div>
          <div className="text-left">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">复核</div>
            <div className="text-sm font-bold text-slate-900">人工评估</div>
            <div className="text-xs text-slate-500">老师可在这里给诊断打分</div>
          </div>
        </button>
      </div>
    </div>
  );
}
