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

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
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
    delete: (id: string) => apiDelete(`/profiles/${id}`),
    blocks: (id: string) => apiFetch<ProfileBlocks>(`/profiles/${id}/blocks`),
    importFile: (id: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return fetch(`${API_BASE}/profiles/${id}/import`, { method: "POST", body: form }).then(
        (r) => r.json()
      );
    },
    importFiles: (id: string, files: File[]) => {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      return fetch(`${API_BASE}/profiles/${id}/import-batch`, { method: "POST", body: form }).then(
        (r) => r.ok ? r.json() as Promise<{ results: BatchImportResult[] }> : r.text().then((t) => Promise.reject(new Error(t)))
      );
    },
    addFreetext: (id: string, text: string, label: string) => {
      const form = new FormData();
      form.append("text", text);
      form.append("label", label);
      return fetch(`${API_BASE}/profiles/${id}/freetext`, { method: "POST", body: form }).then(
        (r) => r.json()
      );
    },
  },
  blocks: {
    createExperience: (pid: string, data: Partial<Experience>) =>
      apiFetch<Experience>(`/profiles/${pid}/experiences`, { method: "POST", body: JSON.stringify(data) }),
    updateExperience: (pid: string, id: string, data: Partial<Experience>) =>
      apiFetch<Experience>(`/profiles/${pid}/experiences/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deleteExperience: (pid: string, id: string) => apiDelete(`/profiles/${pid}/experiences/${id}`),

    createProject: (pid: string, data: Partial<Project>) =>
      apiFetch<Project>(`/profiles/${pid}/projects`, { method: "POST", body: JSON.stringify(data) }),
    updateProject: (pid: string, id: string, data: Partial<Project>) =>
      apiFetch<Project>(`/profiles/${pid}/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deleteProject: (pid: string, id: string) => apiDelete(`/profiles/${pid}/projects/${id}`),

    createSkill: (pid: string, data: Partial<Skill>) =>
      apiFetch<Skill>(`/profiles/${pid}/skills`, { method: "POST", body: JSON.stringify(data) }),
    updateSkill: (pid: string, id: string, data: Partial<Skill>) =>
      apiFetch<Skill>(`/profiles/${pid}/skills/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deleteSkill: (pid: string, id: string) => apiDelete(`/profiles/${pid}/skills/${id}`),

    createEducation: (pid: string, data: Partial<Education>) =>
      apiFetch<Education>(`/profiles/${pid}/educations`, { method: "POST", body: JSON.stringify(data) }),
    updateEducation: (pid: string, id: string, data: Partial<Education>) =>
      apiFetch<Education>(`/profiles/${pid}/educations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deleteEducation: (pid: string, id: string) => apiDelete(`/profiles/${pid}/educations/${id}`),

    createLanguage: (pid: string, data: Partial<LanguageSkill>) =>
      apiFetch<LanguageSkill>(`/profiles/${pid}/languages`, { method: "POST", body: JSON.stringify(data) }),
    updateLanguage: (pid: string, id: string, data: Partial<LanguageSkill>) =>
      apiFetch<LanguageSkill>(`/profiles/${pid}/languages/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deleteLanguage: (pid: string, id: string) => apiDelete(`/profiles/${pid}/languages/${id}`),

    createCertification: (pid: string, data: Partial<Certification>) =>
      apiFetch<Certification>(`/profiles/${pid}/certifications`, { method: "POST", body: JSON.stringify(data) }),
    updateCertification: (pid: string, id: string, data: Partial<Certification>) =>
      apiFetch<Certification>(`/profiles/${pid}/certifications/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deleteCertification: (pid: string, id: string) => apiDelete(`/profiles/${pid}/certifications/${id}`),

    createAchievement: (pid: string, data: Partial<Achievement>) =>
      apiFetch<Achievement>(`/profiles/${pid}/achievements`, { method: "POST", body: JSON.stringify(data) }),
    updateAchievement: (pid: string, id: string, data: Partial<Achievement>) =>
      apiFetch<Achievement>(`/profiles/${pid}/achievements/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deleteAchievement: (pid: string, id: string) => apiDelete(`/profiles/${pid}/achievements/${id}`),
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
    resumeLatexUrl: (run_id: string, template: string) =>
      `${API_BASE}/export/runs/${run_id}/resume/latex?template=${template}`,
  },
  applications: {
    list: () => apiFetch<Application[]>("/applications"),
    get: (id: string) => apiFetch<ApplicationDetail>(`/applications/${id}`),
    create: (data: ApplicationCreate) =>
      apiFetch<Application>("/applications", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<ApplicationUpdate>) =>
      apiFetch<Application>(`/applications/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => apiDelete(`/applications/${id}`),
  },
  runs: {
    list: (params: { application_id?: string; run_type?: string; profile_id?: string }) => {
      const qs = new URLSearchParams();
      if (params.application_id) qs.set("application_id", params.application_id);
      if (params.run_type) qs.set("run_type", params.run_type);
      if (params.profile_id) qs.set("profile_id", params.profile_id);
      return apiFetch<GenerationRun[]>(`/generate/runs?${qs.toString()}`);
    },
    get: (id: string) => apiFetch<GenerationRun>(`/generate/runs/${id}`),
    patchOutputs: (run_id: string, path: string, value: unknown, op?: string) =>
      apiFetch<GenerationRun>(`/generate/runs/${run_id}/outputs`, {
        method: "PATCH",
        body: JSON.stringify({ path, value, op: op ?? "set" }),
      }),
    compact: (run_id: string) =>
      apiFetch<GenerationRun>(`/generate/runs/${run_id}/compact`, { method: "POST" }),
    delete: (run_id: string) => apiDelete(`/generate/runs/${run_id}`),
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
  profile_id?: string;
  employer?: string;
  role_title?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  employment_type?: string;
  description?: string;
  bullets: string[];
  tech_stack: string[];
  domain_tags: string[];
}

export interface Project {
  id: string;
  profile_id?: string;
  title?: string;
  role?: string;
  time_period?: string;
  description?: string;
  bullets: string[];
  technologies: string[];
  outcomes: string[];
  links: string[];
  domain_tags?: string[];
}

export interface Skill {
  id: string;
  profile_id?: string;
  name: string;
  category?: string;
  proficiency?: string;
  years_of_experience?: number;
}

export interface LanguageSkill {
  id: string;
  profile_id?: string;
  language: string;
  level?: string;
}

export interface Education {
  id: string;
  profile_id?: string;
  institution?: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  grade?: string;
  achievements?: string[];
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
  profile_id?: string;
  name?: string;
  issuer?: string;
  issued_date?: string;
  expiry_date?: string;
  credential_id?: string;
  credential_url?: string;
}

export interface Achievement {
  id: string;
  profile_id?: string;
  statement?: string;
  context?: string;
  metric_type?: string;
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
  application_id?: string;
  run_type: string;
  status: string;
  selected_evidence_ids: string[];
  generation_inputs: Record<string, unknown>;
  generation_outputs: Record<string, unknown>;
  intermediate_repr: Record<string, unknown>;
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

export interface BatchImportResult {
  filename: string;
  status: "ok" | "error";
  document_type?: string;
  evidence_id?: string;
  extracted_entities?: Record<string, number>;
  message?: string;
}

export interface ValidationReport {
  run_id: string;
  overall_supported: boolean;
  unsupported_count: number;
  high_risk_count: number;
  claims: ClaimValidation[];
  summary: string;
}

export type ApplicationStatus =
  | "draft"
  | "ready"
  | "submitted"
  | "interview"
  | "rejected"
  | "offer"
  | "archived";

export interface Application {
  id: string;
  profile_id: string;
  job_id: string;
  status: ApplicationStatus;
  label?: string;
  notes?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  profile_name?: string;
  job_title?: string;
  job_company?: string;
}

export interface ApplicationCreate {
  profile_id: string;
  job_id: string;
  label?: string;
}

export interface ApplicationUpdate {
  status?: ApplicationStatus;
  label?: string;
  notes?: string;
  submitted_at?: string;
}

export interface RunSummary {
  id: string;
  run_type: string;
  status: string;
  created_at: string;
  completed_at?: string;
}

export interface ApplicationDetail extends Application {
  runs: RunSummary[];
}
