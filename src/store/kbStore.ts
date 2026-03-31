import { KnowledgeChunk } from '../types';

export const initialKnowledgeBase: KnowledgeChunk[] = [
  {
    id: 'kb_001_inertia_def',
    concept_name: '惯性',
    chapter: '牛顿运动定律',
    grade: '初中八年级下',
    content_category: 'concept_definition',
    source: '人教版八年级物理下册第八章',
    constructed_by: '系统预置',
    last_updated: '2026-03-17',
    review_status: 'reviewed',
    content: `# 惯性\n## 标准定义\n惯性是物体保持原有运动状态（静止或匀速直线运动）不变的属性。\n惯性是物体本身的固有属性，与物体是否受力、是否运动无关。\n## 关键说明\n- 惯性不是力，不能说"受到惯性的作用"\n- 惯性大小只与质量有关，质量越大，惯性越大\n- 静止的物体有惯性，运动的物体也有惯性\n## 所属章节\n牛顿运动定律 / 初中八年级下\n## 前置知识\n运动与静止的相对性、参考系`
  },
  {
    id: 'ec_001_inertia_reification',
    concept_name: '惯性',
    chapter: '牛顿运动定律',
    grade: '初中八年级下',
    content_category: 'misconception',
    block_type: 'concept_reification',
    source: '课堂观察记录',
    constructed_by: '系统预置',
    last_updated: '2026-03-17',
    review_status: 'reviewed',
    content: `# 错误概念：惯性是一种力\n## 学生典型表述\n"物体运动的时候有惯性（力），停下来就没有了"\n"物体因为有惯性才继续运动"\n"惯性消失了所以物体停下来"\n## 阻滞点类型\nconcept_reification（概念具象化错误）\n## 根因分析\n学生将抽象的"物体属性"具象化为可感知的"力"，\n受日常语言习惯影响（"有劲"="有力"），\n未建立"属性"与"力"的本质区别。\n## 标准纠错路径\n1. 先问静止物体是否有惯性，打破"运动才有惯性"的错误前提\n2. 追问"惯性力"由谁施加，引导学生发现逻辑矛盾\n3. 最终建立：惯性=属性，不是力，不会消失\n## 所属章节\n牛顿运动定律 / 初中八年级下`
  },
  {
    id: 'gs_001_inertia_reification',
    concept_name: '惯性',
    chapter: '牛顿运动定律',
    grade: '初中八年级下',
    content_category: 'guidance_strategy',
    block_type: 'concept_reification',
    source: '教学研究文献',
    constructed_by: '系统预置',
    last_updated: '2026-03-17',
    review_status: 'reviewed',
    content: `# 引导策略：concept_reification 类阻滞点\n## 适用场景\n学生将物理属性（惯性、重力势能等）误解为具体的力或物质\n## 引导问题模板\n- "如果[概念]是一种力，那是谁施加给物体的？"\n- "一个[静止/不运动]的物体，它有没有[概念]？"\n- "你觉得[概念]会随着[运动状态变化]而消失吗？为什么？"\n## 教学策略\n采用"反例引导法"：\n先构造一个学生错误认知无法解释的反例情境，\n让学生在认知冲突中主动修正前概念。\n## 注意事项\n不要直接告诉学生"你错了"，\n先让学生用自己的错误理论解释反例，\n发现解释不通后再引入正确概念。`
  }
];

export function searchKnowledgeBase(query: string, category?: string): KnowledgeChunk[] {
  return initialKnowledgeBase.filter(chunk => {
    const matchQuery = chunk.content.includes(query) || chunk.concept_name.includes(query);
    const matchCategory = category ? chunk.content_category === category : true;
    return matchQuery && matchCategory;
  });
}
