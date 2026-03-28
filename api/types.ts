export interface Persona {
  interests?: string[];
  communication_style?: string;
  values?: string[];
  deal_breakers?: string[];
  about?: string;
  personality_tags?: string[];
  lifestyle?: {
    schedule?: string;
    social_frequency?: string;
  };
}

export interface ContactInfo {
  type: string;
  value: string;
}

export interface RegisterBody {
  agent_id: string;
  persona: Persona;
  contact: ContactInfo;
  callback_url?: string;
}

export interface ConsentBody {
  agent_id: string;
  consent: boolean;
}

export interface DateSummary {
  compatibility_score: number;
  shared_interests: string[];
  communication_style_diff: string;
  potential_friction: string[];
  agent_a_impression: string;
  agent_b_impression: string;
  recommendation: string;
}

export interface DateResult {
  story: string;
  summary: DateSummary | null;
  error?: string;
}
