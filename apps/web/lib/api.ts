const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Profiles ────────────────────────────────────────────────────────────────

export const api = {
  profiles: {
    list: () => apiFetch<Profile[]>("/profiles"),
    get: (id: string) => apiFetch<Profile>(`/profiles/${id}`),
    create: (data: ProfileCreate) =>
      apiFetch<Profile>("/profiles", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<ProfileCreate>) =>
      apiFetch<Profile>(`/profiles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    blocks: (id: string) => apiFetch<ProfileBlocks>(`/profiles/${id}/blocks`),
    importFile: (id: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return fetch(`${API_BASE}/profiles/${id}/import`, { method: "POST", body: form }).then(
        (r) => r.json()
      );
    },
  },
  jobs: {
    list: () => apiFetch<Job[]>("/jobs"),
    get: (id: string) => apiFetch<Job>(`/jobs/${id}`),
    analyze: (raw_text: string) =>
      apiFetch<Job>("/jobs/analyze", { method: "POST", body: JSON.stringify({ raw_text }) }),
  },
  retrieval: {
    evidencePack: (profile_id: string, job_id: string, overrides?: Record<string, string>) =>
      apiFetch<EvidencePack>("/retrieval/evidence-pack", {
        method: "POST",
        body: JSON.stringify({ profile_id, job_id, top_k: 20, overrides: overrides || {} }),
      }),
  },
  generate: {
    resume: (req: GenerationRequest) =>
      apiFetch<GenerationRun>("/generate/resume", { method: "POST", body: JSON.stringify(req) }),
    coverLetter: (req: GenerationRequest) =>
      apiFetch<GenerationRun>("/generate/cover-letter", {
        method: "POST",
        body: JSON.stringify(req),
      }),
    matchAnalysis: (req: GenerationRequest) =>
      apiFetch<GenerationRun>("/generate/match-analysis", {
        method: "POST",
        body: JSON.stringify(req),
      }),
    getRun: (id: string) => apiFetch<GenerationRun>(`/generate/runs/${id}`),
  },
  validate: {
    run: (run_id: string) =>
      apiFetch<ValidationReport>("/validate/generated-output", {
        method: "POST",
        body: JSON.stringify({ run_id }),
      }),
  },
  export: {
    resumeHtmlUrl: (run_id: string) => `${API_BASE}/export/runs/${run_id}/resume/html`,
    coverLetterHtmlUrl: (run_id: string) => `${API_BASE}/export/runs/${run_id}/cover-letter/html`,
    resumePdfUrl: (run_id: string) => `${API_BASE}/export/runs/${run_id}/resume/pdf`,
    coverLetterPdfUrl: (run_id: string) => `${API_BASE}/export/runs/${run_id}/cover-letter/pdf`,
  },
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  display_name: string;
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
  linkedin_url?: string;
  github_url?: string;
  target_roles: string[];
  summary_variants: string[];
  preferences: Record<string, unknown>;
  default_languages: string[];
  created_at: string;
  updated_at: string;
}

export interface ProfileCreate {
  display_name: string;
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
  linkedin_url?: string;
  github_url?: string;
  target_roles?: string[];
  summary_variants?: string[];
  default_languages?: string[];
}

export interface ProfileBlocks {
  profile: Profile;
  experiences: Experience[];
  projects: Project[];
  skills: Skill[];
  languages: LanguageSkill[];
  educations: Education[];
  publications: Publication[];
  certifications: Certification[];
  achievements: Achievement[];
  evidence_items: EvidenceItem[];
}

export interface Experience {
  id: string;
  employer: string;
  role_title: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  employment_type?: string;
  bullets: string[];
  tech_stack: string[];
  domain_tags: string[];
}

export interface Project {
  id: string;
  title: string;
  role?: string;
  time_period?: string;
  description?: string;
  technologies: string[];
  outcomes: string[];
}

export interface Skill {
  id: string;
  name: string;
  category?: string;
  proficiency?: string;
}

export interface LanguageSkill {
  id: string;
  language: string;
  level: string;
}

export interface Education {
  id: string;
  institution: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
}

export interface Publication {
  id: string;
  title: string;
  pub_type: string;
  venue?: string;
  published_date?: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issued_date?: string;
}

export interface Achievement {
  id: string;
  statement: string;
  metric_value?: string;
}

export interface EvidenceItem {
  id: string;
  source_type: string;
  source_name?: string;
  raw_text: string;
  trust_level: number;
  created_at: string;
}

export interface Job {
  id: string;
  raw_text: string;
  title?: string;
  company?: string;
  seniority?: string;
  location?: string;
  remote_hint?: string;
  output_language: string;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  responsibilities: string[];
  domain_terms: string[];
  soft_skills: string[];
  keywords: string[];
  created_at: string;
  updated_at: string;
}

export interface EvidenceEntry {
  entity_type: string;
  entity_id: string;
  evidence_ids: string[];
  relevance_score: number;
  reasons: string[];
}

export interface EvidencePack {
  profile_id: string;
  job_id: string;
  entries: EvidenceEntry[];
  total_score: number;
  retrieval_method: string;
}

export interface GenerationRequest {
  profile_id: string;
  job_id: string;
  selected_evidence_ids?: string[];
  options?: Record<string, unknown>;
}

export interface GenerationRun {
  id: string;
  profile_id: string;
  job_description_id: string;
  run_type: string;
  status: string;
  selected_evidence_ids: string[];
  generation_inputs: Record<string, unknown>;
  generation_outputs: Record<string, unknown>;
  validation_report: Record<string, unknown>;
  model_name?: string;
  created_at: string;
  completed_at?: string;
}

export interface ClaimValidation {
  claim: string;
  supported: boolean;
  evidence_ids: string[];
  risk_level: string;
  reason?: string;
}

export interface ValidationReport {
  run_id: string;
  overall_supported: boolean;
  unsupported_count: number;
  high_risk_count: number;
  claims: ClaimValidation[];
  summary: string;
}
