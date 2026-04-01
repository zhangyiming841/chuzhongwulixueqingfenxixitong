import { genericFallbackConcept, physicsConceptCatalog } from '../data/physicsConceptCatalog';
import { initialKnowledgeBase } from '../store/kbStore';
import { DiagnosisResult, KnowledgeChunk } from '../types';

type MasteryLevel = DiagnosisResult['mastery_assessment']['level'];

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, '').replace(/[，。！？、；：,.!?;:]/g, '');
}

function extractEvidence(dialogue: string) {
  return dialogue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');
}

function getChunks(conceptName: string, knowledgeBase: KnowledgeChunk[]) {
  return knowledgeBase.filter((chunk) => chunk.concept_name === conceptName);
}

function getChunkText(
  chunks: KnowledgeChunk[],
  category: KnowledgeChunk['content_category'],
  fallback: string,
) {
  return chunks.find((chunk) => chunk.content_category === category)?.content ?? fallback;
}

function scoreConcept(normalizedDialogue: string, conceptName: string) {
  const profile = physicsConceptCatalog.find((item) => item.concept === conceptName);
  if (!profile) {
    return 0;
  }

  let score = 0;

  for (const alias of profile.aliases) {
    if (normalizedDialogue.includes(normalizeText(alias))) {
      score += 5;
    }
  }

  for (const keyword of profile.keywords) {
    if (normalizedDialogue.includes(normalizeText(keyword))) {
      score += 3;
    }
  }

  for (const pattern of profile.misconceptionPatterns) {
    if (pattern.test(normalizedDialogue)) {
      score += 6;
    }
  }

  for (const pattern of profile.functionalPatterns) {
    if (pattern.test(normalizedDialogue)) {
      score += 4;
    }
  }

  for (const pattern of profile.generativePatterns) {
    if (pattern.test(normalizedDialogue)) {
      score += 5;
    }
  }

  return score;
}

function detectConcept(dialogue: string) {
  const normalizedDialogue = normalizeText(dialogue);
  const ranked = physicsConceptCatalog
    .map((profile) => ({
      profile,
      score: scoreConcept(normalizedDialogue, profile.concept),
    }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  return best && best.score >= 4 ? best.profile : genericFallbackConcept;
}

function detectMasteryLevel(dialogue: string, conceptName: string): MasteryLevel {
  const normalizedDialogue = normalizeText(dialogue);
  const profile =
    physicsConceptCatalog.find((item) => item.concept === conceptName) ?? genericFallbackConcept;

  if (!normalizedDialogue) {
    return 'no_response';
  }

  if (profile.misconceptionPatterns.some((pattern) => pattern.test(normalizedDialogue))) {
    return 'misconception';
  }

  if (profile.generativePatterns.some((pattern) => pattern.test(normalizedDialogue))) {
    return 'generative';
  }

  if (profile.functionalPatterns.some((pattern) => pattern.test(normalizedDialogue))) {
    return 'functional';
  }

  return 'surface';
}

function confidenceByLevel(level: MasteryLevel, conceptName: string) {
  if (conceptName === genericFallbackConcept.concept) {
    return 0.48;
  }

  switch (level) {
    case 'misconception':
      return 0.88;
    case 'surface':
      return 0.73;
    case 'functional':
      return 0.82;
    case 'generative':
      return 0.9;
    default:
      return 0.52;
  }
}

function levelDescription(level: MasteryLevel, conceptName: string) {
  if (conceptName === genericFallbackConcept.concept) {
    return '当前问题暂未稳定定位到单一知识点，建议继续补充题干、图示或学生解释过程。';
  }

  switch (level) {
    case 'misconception':
      return `学生围绕“${conceptName}”出现了较稳定的错误判断，当前需要先纠偏再深化。`;
    case 'surface':
      return `学生能说出部分现象结论，但对“${conceptName}”的定义和推理链还不完整。`;
    case 'functional':
      return `学生对“${conceptName}”已有基本可用理解，能在标准情境下做出较正确判断。`;
    case 'generative':
      return `学生能够迁移使用“${conceptName}”，并能把定义、条件和情境联系起来。`;
    default:
      return `当前关于“${conceptName}”的有效证据不足，建议继续追问。`;
  }
}

function blockType(level: MasteryLevel, conceptName: string) {
  if (conceptName === genericFallbackConcept.concept) {
    return 'scope_ambiguous';
  }

  switch (level) {
    case 'misconception':
      return 'stable_misconception';
    case 'surface':
      return 'incomplete_reasoning';
    case 'functional':
      return 'boundary_unclear';
    case 'generative':
      return 'low_risk';
    default:
      return 'insufficient_evidence';
  }
}

function blockDescription(level: MasteryLevel, misconceptionText: string, conceptName: string) {
  if (conceptName === genericFallbackConcept.concept) {
    return misconceptionText;
  }

  switch (level) {
    case 'misconception':
      return misconceptionText;
    case 'surface':
      return `学生已经触碰到“${conceptName}”的关键现象，但还没有把定义、条件和结论连成完整链条。`;
    case 'functional':
      return `学生在典型题上能够判断“${conceptName}”，但一旦换情境，概念边界还容易模糊。`;
    case 'generative':
      return `当前没有明显阻滞点，建议通过变式题确认“${conceptName}”是否真正稳定。`;
    default:
      return `对话信息较少，暂时无法稳定判断“${conceptName}”的阻滞点。`;
  }
}

function emotionSignal(dialogue: string) {
  if (/(不会|不懂|好难|总错|听不懂|想不明白)/.test(dialogue)) {
    return 'frustrated';
  }
  if (/(应该|我猜|可能|大概|也许)/.test(dialogue)) {
    return 'uncertain';
  }
  return 'neutral';
}

function interventionUrgency(
  level: MasteryLevel,
  conceptName: string,
): DiagnosisResult['learning_status']['intervention_urgency'] {
  if (conceptName === genericFallbackConcept.concept) {
    return 'medium';
  }

  if (level === 'misconception') {
    return 'high';
  }
  if (level === 'surface' || level === 'no_response') {
    return 'medium';
  }
  return 'low';
}

function engagementLevel(dialogue: string) {
  const lines = dialogue.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length;
  if (lines >= 4 || dialogue.length > 90) {
    return 'high';
  }
  if (lines >= 2 || dialogue.length > 30) {
    return 'medium';
  }
  return 'low';
}

function buildQuestions(conceptName: string) {
  const profile =
    physicsConceptCatalog.find((item) => item.concept === conceptName) ?? genericFallbackConcept;

  return profile.socraticTemplates.slice(0, 3);
}

function buildSummary(level: MasteryLevel, conceptName: string) {
  if (conceptName === genericFallbackConcept.concept) {
    return '系统暂时将这段输入归为综合判断场景，当前更适合先补充条件，再缩小到具体章节和概念。';
  }

  switch (level) {
    case 'misconception':
      return `系统判断本次对话主要聚焦“${conceptName}”，学生当前存在较明显误解，建议先追问定义和条件，再用反例纠偏。`;
    case 'surface':
      return `系统判断本次对话主要聚焦“${conceptName}”，学生能说出现象结论，但解释链条还停留在表层。`;
    case 'functional':
      return `系统判断本次对话主要聚焦“${conceptName}”，学生已具备基本可用理解，可以通过变式题继续压实。`;
    case 'generative':
      return `系统判断本次对话主要聚焦“${conceptName}”，学生已能在不同情境下迁移使用，整体表现较稳定。`;
    default:
      return `系统暂时将本次对话归到“${conceptName}”，但证据不足，建议继续补充对话后再诊断。`;
  }
}

function chapterForConcept(conceptName: string) {
  return (
    physicsConceptCatalog.find((item) => item.concept === conceptName)?.chapter ??
    genericFallbackConcept.chapter
  );
}

function teacherFocusForConcept(conceptName: string) {
  return (
    physicsConceptCatalog.find((item) => item.concept === conceptName)?.teacherFocus ??
    genericFallbackConcept.teacherFocus
  );
}

function rootCauseForConcept(conceptName: string) {
  return (
    physicsConceptCatalog.find((item) => item.concept === conceptName)?.rootCause ??
    genericFallbackConcept.rootCause
  );
}

export async function diagnoseDialogue(
  dialogue: string,
  studentId: string,
  sessionId: string,
  knowledgeBase: KnowledgeChunk[] = initialKnowledgeBase,
): Promise<DiagnosisResult> {
  const conceptProfile = detectConcept(dialogue);
  const conceptName = conceptProfile.concept;
  const chunks = getChunks(conceptName, knowledgeBase);
  const level = detectMasteryLevel(dialogue, conceptName);
  const definition = getChunkText(
    chunks,
    'concept_definition',
    `${conceptName}的标准定义暂未写入知识库。`,
  );
  const misconceptionText = getChunkText(
    chunks,
    'misconception',
    `当前围绕“${conceptName}”存在概念边界不清的问题。`,
  );

  return {
    id: crypto.randomUUID(),
    student_id: studentId,
    session_id: sessionId,
    created_at: new Date().toISOString(),
    source_type: 'manual',
    dialogue,
    knowledge_point: {
      chapter: chapterForConcept(conceptName),
      concept: conceptName,
      standard_definition: definition,
    },
    mastery_assessment: {
      level,
      level_description: levelDescription(level, conceptName),
      evidence: extractEvidence(dialogue),
      confidence: confidenceByLevel(level, conceptName),
    },
    cognitive_block: {
      type: blockType(level, conceptName),
      description: blockDescription(level, misconceptionText, conceptName),
      root_cause: rootCauseForConcept(conceptName),
    },
    learning_status: {
      engagement_level: engagementLevel(dialogue),
      emotion_signal: emotionSignal(dialogue),
      intervention_urgency: interventionUrgency(level, conceptName),
    },
    guided_questions: buildQuestions(conceptName),
    teacher_recommendation: teacherFocusForConcept(conceptName),
    rag_source: chunks.map((chunk) => chunk.id).join(', ') || 'local_frontend_rules',
    diagnostic_summary: buildSummary(level, conceptName),
  };
}
