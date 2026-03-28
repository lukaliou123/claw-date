import OpenAI from "openai";
import type { Persona, DateResult, DateSummary } from "../types.js";

function getLLMClient(): OpenAI {
  return new OpenAI({
    baseURL: process.env["LLM_BASE_URL"] || "https://api.deepseek.com",
    apiKey: process.env["LLM_API_KEY"],
  });
}

const SYSTEM_PROMPT = `你是一个赛博约会模拟器。你将根据两个人的画像，模拟他们通过各自的 AI Agent 进行一次虚拟约会的完整过程。

要求：
1. 约会发生在一个具体的场景中（由用户指定）
2. 行为和话题必须忠实反映各自画像的真实偏好，不美化不丑化
3. 保留自然的摩擦、尴尬、沉默，不要让双方天然完美契合
4. 对话要有个性和温度，像真人一样有口头禅、停顿、情绪波动
5. 故事长度 800~1500 字

输出格式严格如下（用 --- 分隔两部分）：

[故事开始]
（800~1500 字的叙事体故事）
[故事结束]

---

[分析开始]
（JSON 格式的分析摘要）
[分析结束]

分析摘要 JSON 结构：
{
  "compatibility_score": <0-100的整数>,
  "shared_interests": ["<共同点1>", "<共同点2>"],
  "communication_style_diff": "<一两句话描述沟通风格差异>",
  "potential_friction": ["<摩擦点1>"],
  "agent_a_impression": "<A 对 B 的一句话印象>",
  "agent_b_impression": "<B 对 A 的一句话印象>",
  "recommendation": "<值得一聊 | 风格差异较大 | 兴趣高度重合 | 需要磨合>"
}`;

function buildUserPrompt(
  personaA: Persona,
  personaB: Persona,
  scene: string,
): string {
  return `Agent A 的主人画像：
${JSON.stringify(personaA, null, 2)}

Agent B 的主人画像：
${JSON.stringify(personaB, null, 2)}

约会场景：${scene}

请开始模拟这次赛博约会。`;
}

export function parseStoryAndSummary(raw: string): DateResult {
  const storyMatch = raw.match(
    /\[故事开始\]\s*([\s\S]*?)\s*\[故事结束\]/,
  );
  const summaryMatch = raw.match(
    /\[分析开始\]\s*([\s\S]*?)\s*\[分析结束\]/,
  );

  const story = storyMatch?.[1]?.trim() ?? raw.trim();

  let summary: DateSummary | null = null;
  let error: string | undefined;

  if (summaryMatch?.[1]) {
    try {
      summary = JSON.parse(summaryMatch[1].trim()) as DateSummary;
    } catch (e) {
      error = `JSON parse error: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    error = "No summary block found in LLM response";
  }

  return { story, summary, error };
}

function findCommonInterests(a: Persona, b: Persona): string[] {
  const setA = new Set((a.interests ?? []).map((s) => s.toLowerCase()));
  const result: string[] = [];
  for (const item of b.interests ?? []) {
    if (setA.has(item.toLowerCase())) result.push(item);
  }
  return result;
}

function generateMockDate(
  personaA: Persona,
  personaB: Persona,
  scene: string,
): DateResult {
  const shared = findCommonInterests(personaA, personaB);
  const score = 40 + Math.floor(Math.random() * 40);

  return {
    story:
      `${scene}。\n\n` +
      `A 是这样的人：${personaA.about ?? "一个神秘的人"}。` +
      `B 是这样的人：${personaB.about ?? "另一个神秘的人"}。\n\n` +
      `两人坐下来，开始聊起了${shared.length > 0 ? shared.join("、") : "各自的生活"}。` +
      `A 的说话风格是${personaA.communication_style ?? "平和的"}，` +
      `B 则${personaB.communication_style ?? "也挺随意"}。\n\n` +
      `聊到一半，话题转向了${personaA.values?.[0] ?? "人生"}的意义。` +
      `两个人发现彼此${score > 60 ? "意外地有很多共鸣" : "看法挺不一样的"}。\n\n` +
      `约会结束时，A 回头看了一眼${scene.slice(0, 10)}，` +
      `心想：${score > 60 ? "下次可以再聊聊" : "有意思的人，但不确定合不合适"}。`,
    summary: {
      compatibility_score: score,
      shared_interests:
        shared.length > 0 ? shared : ["暂无明显共同点"],
      communication_style_diff: `A ${personaA.communication_style ?? "未知"}, B ${personaB.communication_style ?? "未知"}`,
      potential_friction: ["[Mock] 待真实 LLM 分析"],
      agent_a_impression: score > 60 ? "有趣的人" : "还行",
      agent_b_impression: score > 60 ? "值得再聊" : "第一印象一般",
      recommendation: score > 60 ? "值得一聊" : "风格差异较大",
    },
  };
}

export async function generateDate(
  personaA: Persona,
  personaB: Persona,
  scene: string,
): Promise<DateResult> {
  if (process.env["MOCK_LLM"] === "true") {
    return generateMockDate(personaA, personaB, scene);
  }

  const client = getLLMClient();
  const model = process.env["LLM_MODEL"] || "deepseek-chat";
  const userPrompt = buildUserPrompt(personaA, personaB, scene);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 1.0,
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { story: "", summary: null, error: "Empty LLM response" };
    }

    return parseStoryAndSummary(content);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { story: "", summary: null, error: `LLM call failed: ${msg}` };
  }
}
