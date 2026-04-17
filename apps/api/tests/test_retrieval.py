from services.retrieval import _build_keyword_set, _score_experience, _score_skills
from models import JobDescription, Experience, Skill


def make_job(**kwargs) -> JobDescription:
    defaults = dict(
        id="job1",
        raw_text="test",
        must_have_skills=["Python", "FastAPI"],
        nice_to_have_skills=["Docker"],
        responsibilities=["Build APIs"],
        domain_terms=["backend"],
        keywords=["python", "api"],
        language_requirements=[],
        education_requirements=[],
        soft_skills=[],
        output_language="en",
    )
    defaults.update(kwargs)
    return JobDescription(**defaults)


def test_build_keyword_set():
    job = make_job()
    kws = _build_keyword_set(job)
    assert "python" in kws
    assert "fastapi" in kws
    assert "docker" in kws


def test_score_experience_matching():
    job = make_job()
    kws = _build_keyword_set(job)
    exp = Experience(
        id="e1",
        profile_id="p1",
        employer="Acme",
        role_title="Backend Engineer",
        tech_stack=["Python", "FastAPI", "Docker"],
        bullets=["Built REST APIs with FastAPI"],
        domain_tags=["backend"],
    )
    score, reasons = _score_experience(exp, job, kws)
    assert score > 0
    assert len(reasons) > 0


def test_score_experience_no_match():
    job = make_job()
    kws = _build_keyword_set(job)
    exp = Experience(
        id="e2",
        profile_id="p1",
        employer="Unrelated Corp",
        role_title="Marketing Manager",
        tech_stack=[],
        bullets=["Managed marketing campaigns"],
        domain_tags=["marketing"],
    )
    score, _ = _score_experience(exp, job, kws)
    assert score == 0


def test_score_skills_matching():
    job = make_job()
    skills = [
        Skill(id="s1", profile_id="p1", name="Python"),
        Skill(id="s2", profile_id="p1", name="Docker"),
        Skill(id="s3", profile_id="p1", name="Excel"),
    ]
    result = _score_skills(skills, job)
    assert result is not None
    assert result["score"] > 0
    assert any("Python" in r or "python" in r.lower() for r in result["reasons"])
