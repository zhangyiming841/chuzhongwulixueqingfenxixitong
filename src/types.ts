export interface KnowledgeChunk {
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
}

export interface DiagnosisResult {
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
}

export interface EvaluationForm {
  concept_accuracy: number;
  block_identification: number;
  question_effectiveness: number;
  format_stability: number;
  weighted_score: number;
  review_suggestion: 'pass' | 'optimize' | 'manual_review';
  key_issues: string;
}
