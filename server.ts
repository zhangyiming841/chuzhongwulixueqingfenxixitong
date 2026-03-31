import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

type KnowledgeChunk = {
  id: string;
  concept_name: string;
  chapter: string;
  grade: string;
  content_category: 'concept_definition' | 'misconception' | 'guidance_strategy';
  block_type?: string;
  source: string;
  constructed_by: string;
  last_updated: string;
  review_status: 'reviewed' | 'pending';
  content: string;
};

type DiagnosisResult = {
  id: string;
  student_id: string;
  session_id: string;
  created_at: string;
  source_type: 'manual' | 'upload' | 'voice';
  dialogue: string;
  knowledge_point: {
    chapter: string;
    concept: string;
    standard_definition: string;
  };
  mastery_assessment: {
    level: 'no_response' | 'misconception' | 'surface' | 'functional' | 'generative';
    level_description: string;
    evidence: string;
    confidence: number;
  };
  cognitive_block: {
    type: string;
    description: string;
    root_cause: string;
  };
  learning_status: {
    engagement_level: string;
    emotion_signal: string;
    intervention_urgency: 'low' | 'medium' | 'high';
  };
  guided_questions: string[];
  teacher_recommendation: string;
  rag_source: string;
  diagnostic_summary: string;
};

type EvaluationRecord = {
  id: string;
  diagnosis_id: string;
  created_at: string;
  concept_accuracy: number;
  block_identification: number;
  question_effectiveness: number;
  format_stability: number;
  weighted_score: number;
  review_suggestion: 'pass' | 'optimize' | 'manual_review';
  key_issues: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const knowledgeBaseFile = path.join(dataDir, 'knowledge-base.json');
const diagnosesFile = path.join(dataDir, 'diagnoses.json');
const evaluationsFile = path.join(dataDir, 'evaluations.json');

const conceptProfiles = [
  {
    concept: '惯性',
    chapter: '牛顿运动定律',
    keywords: ['惯性', '停下来', '停下', '运动状态', '匀速', '静止'],
    misconceptionPatterns: [
      '惯性消失',
      '惯性没有了',
      '惯性是一种力',
      '因为惯性才继续运动',
      '停下来就没有惯性',
    ],
    guidanceQuestions: [
      '如果惯性是一种力，那这个力是谁施加给物体的？',
      '静止在桌上的书有没有惯性？为什么？',
      '让物体停下来的真正原因更可能是什么？',
    ],
  },
  {
    concept: '摩擦力',
    chapter: '常见的力',
    keywords: ['摩擦', '摩擦力', '滑动', '地面', '鞋底', '阻碍'],
    misconceptionPatterns: [
      '摩擦力总是有害',
      '摩擦力方向总是向后',
      '没有接触也有摩擦力',
    ],
    guidanceQuestions: [
      '摩擦力一定总是阻碍运动吗，还是阻碍相对运动趋势？',
      '人在走路时，地面对脚的摩擦力方向朝哪边？',
      '如果没有摩擦力，走路会发生什么？',
    ],
  },
  {
    concept: '速度与加速度',
    chapter: '机械运动',
    keywords: ['速度', '加速度', '变快', '变慢', '方向变化', '位移'],
    misconceptionPatterns: [
      '速度大加速度就大',
      '速度为零就没有加速度',
      '加速度就是速度',
    ],
    guidanceQuestions: [
      '加速度描述的是速度大小，还是速度变化快慢？',
      '汽车拐弯时速度大小不变，会不会有加速度？',
      '速度为零的瞬间，物体一定没有加速度吗？',
    ],
  },
  {
    concept: '电流与电压',
    chapter: '电学基础',
    keywords: ['电流', '电压', '电路', '电荷', '电源', '串联', '并联'],
    misconceptionPatterns: [
      '电压会流动',
      '电流和电压是同一个东西',
      '电流越大电压一定越大',
    ],
    guidanceQuestions: [
      '电流和电压分别描述电路中的什么？',
      '如果把电压比作推动作用，那电流更像什么？',
      '串联电路和并联电路里电流、电压的分配一样吗？',
    ],
  },
  {
    concept: '凸透镜成像',
    chapter: '光学',
    keywords: ['凸透镜', '成像', '焦距', '像距', '物距', '实像', '虚像'],
    misconceptionPatterns: [
      '物体越远像越大',
      '凸透镜只能成实像',
      '焦点是像的位置',
    ],
    guidanceQuestions: [
      '物距、像距、焦距三者分别表示什么？',
      '凸透镜什么时候成实像，什么时候成虚像？',
      '如果把物体放在一倍焦距以内，会看到什么现象？',
    ],
  },
];

async function ensureDataFile(filePath: string, fallback: string) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, fallback, 'utf8');
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, '');
}

function summarizeDialogue(dialogue: string) {
  return dialogue.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 3).join(' ');
}

function extractDefinition(chunks: KnowledgeChunk[]) {
  const defChunk = chunks.find((chunk) => chunk.content_category === 'concept_definition');
  if (!defChunk) {
    return '暂未在知识库中找到标准定义，请教师结合课堂语境人工补充。';
  }

  const line = defChunk.content
    .split('\n')
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith('#') && !item.startsWith('-'));

  return line ?? defChunk.content;
}

function extractGuidanceQuestions(chunks: KnowledgeChunk[], fallback: string[]) {
  const guidanceChunk = chunks.find((chunk) => chunk.content_category === 'guidance_strategy');
  if (!guidanceChunk) {
    return fallback;
  }

  const extracted = guidanceChunk.content
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.startsWith('- '))
    .map((item) => item.replace(/^- /, '').trim())
    .slice(0, 3);

  return extracted.length > 0 ? extracted : fallback;
}

function detectEmotionSignal(dialogue: string) {
  if (/(不会|不懂|好难|总错|听不懂|搞不清)/.test(dialogue)) return 'frustrated';
  if (/(我觉得|是不是|可能|应该)/.test(dialogue)) return 'exploring';
  return 'neutral';
}

function detectEngagementLevel(dialogue: string) {
  const lineCount = dialogue.split(/\r?\n/).filter((line) => line.trim()).length;
  if (lineCount >= 4) return 'high';
  if (lineCount >= 2) return 'medium';
  return 'low';
}

function classifyUrgency(level: DiagnosisResult['mastery_assessment']['level'], emotionSignal: string) {
  if (level === 'misconception' || emotionSignal === 'frustrated') return 'high';
  if (level === 'surface' || level === 'no_response') return 'medium';
  return 'low';
}

function selectConceptProfile(dialogue: string) {
  const normalized = normalizeText(dialogue);
  const scored = conceptProfiles.map((profile) => ({
    profile,
    score: profile.keywords.reduce((sum, keyword) => sum + (normalized.includes(normalizeText(keyword)) ? 1 : 0), 0),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].profile : conceptProfiles[0];
}

function computeHeuristicDiagnosis(
  dialogue: string,
  studentId: string,
  sessionId: string,
  sourceType: DiagnosisResult['source_type'],
  knowledgeBase: KnowledgeChunk[],
): DiagnosisResult {
  const profile = selectConceptProfile(dialogue);
  const matchedChunks = knowledgeBase.filter((chunk) => chunk.concept_name === profile.concept);
  const normalized = normalizeText(dialogue);
  const misconceptionHit = profile.misconceptionPatterns.find((pattern) => normalized.includes(normalizeText(pattern)));
  const engagementLevel = detectEngagementLevel(dialogue);
  const emotionSignal = detectEmotionSignal(dialogue);

  let level: DiagnosisResult['mastery_assessment']['level'] = 'surface';
  let levelDescription = '学生能复述部分现象，但概念关系尚不稳定。';
  let blockType = 'concept_boundary_blur';
  let blockDescription = '学生对概念边界理解模糊，容易把表象当成原理。';
  let rootCause = '基础概念与课堂情境之间的映射还没有建立稳固联系。';
  let confidence = 0.66;

  if (!dialogue.trim()) {
    level = 'no_response';
    levelDescription = '当前没有足够对话内容，无法判断真实掌握情况。';
    blockType = 'insufficient_evidence';
    blockDescription = '证据不足，建议补充完整课堂追问。';
    rootCause = '输入内容过短，缺少学生解释性表述。';
    confidence = 0.35;
  } else if (misconceptionHit) {
    level = 'misconception';
    levelDescription = '学生存在明确误概念，需要教师及时纠偏。';
    blockType = 'stable_misconception';
    blockDescription = `学生表述中出现“${misconceptionHit}”这类典型误概念信号。`;
    rootCause = '学生把生活化语言直接套用到物理概念，尚未建立规范表征。';
    confidence = 0.88;
  } else if (/(可能|是不是|我猜|应该|大概)/.test(dialogue)) {
    level = 'surface';
    levelDescription = '学生有初步判断，但推理链条不完整。';
    blockType = 'incomplete_reasoning';
    blockDescription = '学生能给出结论倾向，但解释过程还比较薄弱。';
    rootCause = '概念回忆有基础，但缺少对条件和因果的稳定理解。';
    confidence = 0.72;
  } else if (/(因为|所以|如果|那么)/.test(dialogue)) {
    level = 'functional';
    levelDescription = '学生可以在教师引导下说明原因，具备可继续提升的应用能力。';
    blockType = 'transfer_friction';
    blockDescription = '学生理解基本概念，但在迁移到新情境时还不够稳。';
    rootCause = '从定义到应用的迁移还需要更多范例支持。';
    confidence = 0.79;
  }

  const guidedQuestions = extractGuidanceQuestions(matchedChunks, profile.guidanceQuestions);
  const standardDefinition = extractDefinition(matchedChunks);
  const urgency = classifyUrgency(level, emotionSignal);
  const evidence = summarizeDialogue(dialogue) || '未提供足够证据';
  const chapter = matchedChunks[0]?.chapter ?? profile.chapter;
  const sourceIds = matchedChunks.map((chunk) => chunk.id).join(', ') || 'local_heuristic';

  return {
    id: randomUUID(),
    student_id: studentId,
    session_id: sessionId,
    created_at: new Date().toISOString(),
    source_type: sourceType,
    dialogue,
    knowledge_point: {
      chapter,
      concept: profile.concept,
      standard_definition: standardDefinition,
    },
    mastery_assessment: {
      level,
      level_description: levelDescription,
      evidence,
      confidence,
    },
    cognitive_block: {
      type: blockType,
      description: blockDescription,
      root_cause: rootCause,
    },
    learning_status: {
      engagement_level: engagementLevel,
      emotion_signal: emotionSignal,
      intervention_urgency: urgency,
    },
    guided_questions: guidedQuestions,
    teacher_recommendation: `建议围绕“${profile.concept}”先做一次简短追问，再用一个反例或实验场景帮助学生把概念和生活化说法分开，最后让学生自己复述修正后的判断。`,
    rag_source: sourceIds,
    diagnostic_summary: `系统判断本次对话主要聚焦在“${profile.concept}”，当前掌握层级为 ${level}，建议教师优先处理 ${blockType}。`,
  };
}

async function tryAiDiagnosis(
  heuristic: DiagnosisResult,
  knowledgeBase: KnowledgeChunk[],
): Promise<DiagnosisResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const relatedChunks = knowledgeBase
    .filter((chunk) => chunk.concept_name === heuristic.knowledge_point.concept)
    .slice(0, 6)
    .map((chunk) => `[${chunk.id}] ${chunk.content}`)
    .join('\n\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `你是一位初中物理教研员。请根据知识库内容和课堂对话，输出一个严格 JSON。

知识库：
${relatedChunks}

课堂对话：
${heuristic.dialogue}

已知基础判断：
${JSON.stringify({
      concept: heuristic.knowledge_point.concept,
      chapter: heuristic.knowledge_point.chapter,
      fallbackLevel: heuristic.mastery_assessment.level,
      fallbackBlock: heuristic.cognitive_block.type,
    })}
`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          knowledge_point: {
            type: 'object',
            properties: {
              chapter: { type: 'string' },
              concept: { type: 'string' },
              standard_definition: { type: 'string' },
            },
            required: ['chapter', 'concept', 'standard_definition'],
          },
          mastery_assessment: {
            type: 'object',
            properties: {
              level: { type: 'string' },
              level_description: { type: 'string' },
              evidence: { type: 'string' },
              confidence: { type: 'number' },
            },
            required: ['level', 'level_description', 'evidence', 'confidence'],
          },
          cognitive_block: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              description: { type: 'string' },
              root_cause: { type: 'string' },
            },
            required: ['type', 'description', 'root_cause'],
          },
          learning_status: {
            type: 'object',
            properties: {
              engagement_level: { type: 'string' },
              emotion_signal: { type: 'string' },
              intervention_urgency: { type: 'string' },
            },
            required: ['engagement_level', 'emotion_signal', 'intervention_urgency'],
          },
          guided_questions: {
            type: 'array',
            items: { type: 'string' },
          },
          teacher_recommendation: { type: 'string' },
          diagnostic_summary: { type: 'string' },
        },
        required: [
          'knowledge_point',
          'mastery_assessment',
          'cognitive_block',
          'learning_status',
          'guided_questions',
          'teacher_recommendation',
          'diagnostic_summary',
        ],
      },
    },
  });

  const parsed = JSON.parse(response.text ?? '{}') as Partial<DiagnosisResult>;
  if (!parsed.knowledge_point || !parsed.mastery_assessment || !parsed.cognitive_block || !parsed.learning_status) {
    return null;
  }

  return {
    ...heuristic,
    knowledge_point: parsed.knowledge_point,
    mastery_assessment: {
      ...heuristic.mastery_assessment,
      ...parsed.mastery_assessment,
      level: (parsed.mastery_assessment.level as DiagnosisResult['mastery_assessment']['level']) ?? heuristic.mastery_assessment.level,
      confidence: Number(parsed.mastery_assessment.confidence ?? heuristic.mastery_assessment.confidence),
    },
    cognitive_block: parsed.cognitive_block,
    learning_status: {
      ...heuristic.learning_status,
      ...parsed.learning_status,
      intervention_urgency:
        (parsed.learning_status.intervention_urgency as DiagnosisResult['learning_status']['intervention_urgency']) ??
        heuristic.learning_status.intervention_urgency,
    },
    guided_questions: Array.isArray(parsed.guided_questions) && parsed.guided_questions.length > 0
      ? parsed.guided_questions.slice(0, 5)
      : heuristic.guided_questions,
    teacher_recommendation: parsed.teacher_recommendation ?? heuristic.teacher_recommendation,
    diagnostic_summary: parsed.diagnostic_summary ?? heuristic.diagnostic_summary,
  };
}

function computeWeightedScore(payload: Omit<EvaluationRecord, 'id' | 'created_at' | 'weighted_score' | 'review_suggestion'>) {
  const weightedScore = Number(
    (
      payload.concept_accuracy * 0.35 +
      payload.block_identification * 0.3 +
      payload.question_effectiveness * 0.25 +
      payload.format_stability * 0.1
    ).toFixed(2),
  );

  let reviewSuggestion: EvaluationRecord['review_suggestion'] = 'pass';
  if (weightedScore < 2.6) reviewSuggestion = 'manual_review';
  else if (weightedScore < 3.8) reviewSuggestion = 'optimize';

  return { weightedScore, reviewSuggestion };
}

async function startServer() {
  await ensureDataFile(knowledgeBaseFile, '[]\n');
  await ensureDataFile(diagnosesFile, '[]\n');
  await ensureDataFile(evaluationsFile, '[]\n');

  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', async (_req, res) => {
    const knowledgeBase = await readJsonFile<KnowledgeChunk[]>(knowledgeBaseFile, []);
    const diagnoses = await readJsonFile<DiagnosisResult[]>(diagnosesFile, []);
    const evaluations = await readJsonFile<EvaluationRecord[]>(evaluationsFile, []);

    res.json({
      ok: true,
      storage: {
        knowledgeBase: knowledgeBase.length,
        diagnoses: diagnoses.length,
        evaluations: evaluations.length,
      },
      aiEnabled: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.get('/api/dashboard', async (_req, res) => {
    const diagnoses = await readJsonFile<DiagnosisResult[]>(diagnosesFile, []);
    const evaluations = await readJsonFile<EvaluationRecord[]>(evaluationsFile, []);
    const knowledgeBase = await readJsonFile<KnowledgeChunk[]>(knowledgeBaseFile, []);

    const conceptCounts = diagnoses.reduce<Record<string, number>>((acc, item) => {
      acc[item.knowledge_point.concept] = (acc[item.knowledge_point.concept] ?? 0) + 1;
      return acc;
    }, {});

    const topConcepts = Object.entries(conceptCounts)
      .map(([concept, count]) => ({ concept, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const avgScore =
      evaluations.length > 0
        ? Number((evaluations.reduce((sum, item) => sum + item.weighted_score, 0) / evaluations.length).toFixed(2))
        : null;

    res.json({
      totalDiagnoses: diagnoses.length,
      totalKnowledgeChunks: knowledgeBase.length,
      totalEvaluations: evaluations.length,
      averageEvaluationScore: avgScore,
      topConcepts,
      recentDiagnoses: diagnoses.slice(0, 5),
    });
  });

  app.get('/api/knowledge-base', async (req, res) => {
    const knowledgeBase = await readJsonFile<KnowledgeChunk[]>(knowledgeBaseFile, []);
    const query = String(req.query.query || '').trim();
    const category = String(req.query.category || '').trim();

    const filtered = knowledgeBase.filter((chunk) => {
      const queryHit = query
        ? `${chunk.concept_name} ${chunk.chapter} ${chunk.content}`.toLowerCase().includes(query.toLowerCase())
        : true;
      const categoryHit = category ? chunk.content_category === category : true;
      return queryHit && categoryHit;
    });

    res.json(filtered);
  });

  app.post('/api/knowledge-base', async (req, res) => {
    const payload = req.body as Partial<KnowledgeChunk>;
    if (!payload.concept_name || !payload.chapter || !payload.content_category || !payload.content) {
      return res.status(400).json({ error: '缺少必要字段' });
    }

    const knowledgeBase = await readJsonFile<KnowledgeChunk[]>(knowledgeBaseFile, []);
    const nextChunk: KnowledgeChunk = {
      id: payload.id || randomUUID(),
      concept_name: payload.concept_name,
      chapter: payload.chapter,
      grade: payload.grade || '未分类',
      content_category: payload.content_category,
      block_type: payload.block_type,
      source: payload.source || '本地录入',
      constructed_by: payload.constructed_by || '教师',
      last_updated: new Date().toISOString().slice(0, 10),
      review_status: payload.review_status || 'pending',
      content: payload.content,
    };

    knowledgeBase.unshift(nextChunk);
    await writeJsonFile(knowledgeBaseFile, knowledgeBase);
    return res.status(201).json(nextChunk);
  });

  app.put('/api/knowledge-base/:id', async (req, res) => {
    const knowledgeBase = await readJsonFile<KnowledgeChunk[]>(knowledgeBaseFile, []);
    const index = knowledgeBase.findIndex((chunk) => chunk.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: '知识条目不存在' });
    }

    const current = knowledgeBase[index];
    const updated: KnowledgeChunk = {
      ...current,
      ...req.body,
      id: current.id,
      last_updated: new Date().toISOString().slice(0, 10),
    };

    knowledgeBase[index] = updated;
    await writeJsonFile(knowledgeBaseFile, knowledgeBase);
    return res.json(updated);
  });

  app.delete('/api/knowledge-base/:id', async (req, res) => {
    const knowledgeBase = await readJsonFile<KnowledgeChunk[]>(knowledgeBaseFile, []);
    const filtered = knowledgeBase.filter((chunk) => chunk.id !== req.params.id);
    if (filtered.length === knowledgeBase.length) {
      return res.status(404).json({ error: '知识条目不存在' });
    }

    await writeJsonFile(knowledgeBaseFile, filtered);
    return res.status(204).send();
  });

  app.get('/api/diagnoses', async (_req, res) => {
    const diagnoses = await readJsonFile<DiagnosisResult[]>(diagnosesFile, []);
    res.json(diagnoses);
  });

  app.post('/api/diagnose', async (req, res) => {
    const { dialogue, studentId, sessionId, sourceType } = req.body as {
      dialogue?: string;
      studentId?: string;
      sessionId?: string;
      sourceType?: DiagnosisResult['source_type'];
    };

    if (!dialogue?.trim() || !studentId?.trim() || !sessionId?.trim()) {
      return res.status(400).json({ error: '学生、会话和对话内容不能为空' });
    }

    const knowledgeBase = await readJsonFile<KnowledgeChunk[]>(knowledgeBaseFile, []);
    const heuristic = computeHeuristicDiagnosis(dialogue, studentId, sessionId, sourceType || 'manual', knowledgeBase);

    let finalResult = heuristic;
    try {
      const aiResult = await tryAiDiagnosis(heuristic, knowledgeBase);
      if (aiResult) {
        finalResult = aiResult;
      }
    } catch (error) {
      console.warn('AI enhancement skipped, using heuristic diagnosis.', error);
    }

    const diagnoses = await readJsonFile<DiagnosisResult[]>(diagnosesFile, []);
    diagnoses.unshift(finalResult);
    await writeJsonFile(diagnosesFile, diagnoses);

    return res.status(201).json(finalResult);
  });

  app.get('/api/evaluations', async (_req, res) => {
    const evaluations = await readJsonFile<EvaluationRecord[]>(evaluationsFile, []);
    res.json(evaluations);
  });

  app.post('/api/evaluations', async (req, res) => {
    const payload = req.body as Partial<EvaluationRecord>;
    if (!payload.diagnosis_id) {
      return res.status(400).json({ error: '缺少 diagnosis_id' });
    }

    const basePayload = {
      diagnosis_id: payload.diagnosis_id,
      concept_accuracy: Number(payload.concept_accuracy || 0),
      block_identification: Number(payload.block_identification || 0),
      question_effectiveness: Number(payload.question_effectiveness || 0),
      format_stability: Number(payload.format_stability || 0),
      key_issues: String(payload.key_issues || '').trim(),
    };

    const { weightedScore, reviewSuggestion } = computeWeightedScore(basePayload);
    const evaluations = await readJsonFile<EvaluationRecord[]>(evaluationsFile, []);

    const nextEvaluation: EvaluationRecord = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      ...basePayload,
      weighted_score: weightedScore,
      review_suggestion: reviewSuggestion,
    };

    evaluations.unshift(nextEvaluation);
    await writeJsonFile(evaluationsFile, evaluations);
    return res.status(201).json(nextEvaluation);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
