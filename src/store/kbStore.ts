import { genericFallbackConcept, physicsConceptCatalog } from '../data/physicsConceptCatalog';
import { KnowledgeChunk } from '../types';

function buildChunks() {
  const seeds = [...physicsConceptCatalog, genericFallbackConcept];

  return seeds.flatMap<KnowledgeChunk>((seed) => [
    {
      id: `kb_${seed.concept}_definition`,
      concept_name: seed.concept,
      chapter: seed.chapter,
      grade: seed.grade,
      content_category: 'concept_definition',
      source: '系统预置课程知识库',
      constructed_by: '系统预置',
      last_updated: '2026-04-01',
      review_status: 'reviewed',
      content: seed.definition,
    },
    {
      id: `kb_${seed.concept}_misconception`,
      concept_name: seed.concept,
      chapter: seed.chapter,
      grade: seed.grade,
      content_category: 'misconception',
      block_type: 'common_misconception',
      source: '系统预置课程知识库',
      constructed_by: '系统预置',
      last_updated: '2026-04-01',
      review_status: 'reviewed',
      content: seed.misconception,
    },
    {
      id: `kb_${seed.concept}_strategy`,
      concept_name: seed.concept,
      chapter: seed.chapter,
      grade: seed.grade,
      content_category: 'guidance_strategy',
      block_type: 'socratic_guidance',
      source: '系统预置课程知识库',
      constructed_by: '系统预置',
      last_updated: '2026-04-01',
      review_status: 'reviewed',
      content: seed.strategy,
    },
  ]);
}

export const initialKnowledgeBase: KnowledgeChunk[] = buildChunks();

export function searchKnowledgeBase(query: string, category?: string): KnowledgeChunk[] {
  const normalizedQuery = query.trim().toLowerCase();

  return initialKnowledgeBase.filter((chunk) => {
    const haystacks = [chunk.content, chunk.concept_name, chunk.chapter, chunk.grade].map((item) =>
      item.toLowerCase(),
    );
    const matchQuery =
      normalizedQuery.length === 0 || haystacks.some((item) => item.includes(normalizedQuery));
    const matchCategory = category ? chunk.content_category === category : true;
    return matchQuery && matchCategory;
  });
}
