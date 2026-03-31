import { initialKnowledgeBase } from '../store/kbStore';
import { DiagnosisResult, KnowledgeChunk } from '../types';

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, '');
}

function detectConcept(dialogue: string, knowledgeBase: KnowledgeChunk[]) {
  const normalized = normalizeText(dialogue);
  const firstMatch = knowledgeBase.find((chunk) =>
    normalized.includes(normalizeText(chunk.concept_name)) || normalized.includes(normalizeText(chunk.chapter)),
  );

  return firstMatch?.concept_name ?? '惯性';
}

function pickChunks(conceptName: string, knowledgeBase: KnowledgeChunk[]) {
  return knowledgeBase.filter((chunk) => chunk.concept_name === conceptName);
}

function buildQuestions(chunks: KnowledgeChunk[]) {
  const strategyChunk = chunks.find((chunk) => chunk.content_category === 'guidance_strategy');
  if (!strategyChunk) {
    return [
      '你能先说说这个概念本身是什么意思吗？',
      '你现在的判断依据是什么？',
      '如果换一个情境，这个结论还成立吗？',
    ];
  }

  const items = strategyChunk.content
    .split(/[。！？\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  return items.length > 0 ? items : ['你能再解释一下你的判断过程吗？'];
}

export async function diagnoseDialogue(
  dialogue: string,
  studentId: string,
  sessionId: string,
  knowledgeBase: KnowledgeChunk[] = initialKnowledgeBase,
): Promise<DiagnosisResult> {
  const concept = detectConcept(dialogue, knowledgeBase);
  const chunks = pickChunks(concept, knowledgeBase);
  const definition =
    chunks.find((chunk) => chunk.content_category === 'concept_definition')?.content || '暂未命中标准定义。';

  const hasMisconception =
    /惯性消失|惯性没有了|是一种力|不会|不懂|搞不清/.test(dialogue);

  const level: DiagnosisResult['mastery_assessment']['level'] = hasMisconception ? 'misconception' : 'surface';

  return {
    id: crypto.randomUUID(),
    student_id: studentId,
    session_id: sessionId,
    created_at: new Date().toISOString(),
    source_type: 'manual',
    dialogue,
    knowledge_point: {
      chapter: chunks[0]?.chapter || '待判断章节',
      concept,
      standard_definition: definition,
    },
    mastery_assessment: {
      level,
      level_description: hasMisconception ? '学生存在比较明确的误概念。' : '学生有初步理解，但解释链条还不够稳。',
      evidence: dialogue.split(/\r?\n/).filter(Boolean).slice(0, 2).join(' '),
      confidence: hasMisconception ? 0.86 : 0.72,
    },
    cognitive_block: {
      type: hasMisconception ? 'stable_misconception' : 'incomplete_reasoning',
      description: hasMisconception ? '学生把生活化表达直接当成物理概念。' : '学生能给结论，但推理还不完整。',
      root_cause: hasMisconception ? '概念边界不清。' : '从定义到应用的迁移还不稳。',
    },
    learning_status: {
      engagement_level: dialogue.split(/\r?\n/).filter(Boolean).length >= 3 ? 'high' : 'medium',
      emotion_signal: /不会|不懂|好难|总错/.test(dialogue) ? 'frustrated' : 'neutral',
      intervention_urgency: hasMisconception ? 'high' : 'medium',
    },
    guided_questions: buildQuestions(chunks),
    teacher_recommendation: `建议围绕“${concept}”先做一次追问，再用反例帮助学生修正概念。`,
    rag_source: chunks.map((chunk) => chunk.id).join(', ') || 'local_frontend_rules',
    diagnostic_summary: `系统判断本次对话主要聚焦“${concept}”，当前掌握层级为 ${level}。`,
  };
}
