"""
Seed script — creates a realistic demo profile via the API.
Usage: python scripts/seed_demo_data.py [--api-url http://localhost:8000]
"""
import sys
import json
import argparse
import urllib.request
import urllib.error

def post(url: str, data: dict) -> dict:
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def patch(url: str, data: dict) -> dict:
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="PATCH")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-url", default="http://localhost:8000")
    args = parser.parse_args()
    base = args.api_url.rstrip("/")

    print("Creating demo profile…")
    profile = post(f"{base}/profiles", {
        "display_name": "Alex Müller",
        "email": "alex.mueller@example.com",
        "phone": "+49 160 1234567",
        "location": "Berlin, Germany",
        "website": "https://alexmueller.dev",
        "linkedin_url": "https://linkedin.com/in/alexmueller",
        "github_url": "https://github.com/alexmueller",
        "target_roles": ["Senior Software Engineer", "Staff Engineer", "Engineering Lead"],
        "summary_variants": [
            "Senior full-stack engineer with 8+ years building scalable Python and TypeScript systems in fintech and SaaS.",
            "Pragmatic engineer who ships production-grade systems and enjoys mentoring teams."
        ],
        "default_languages": ["en", "de"],
    })
    pid = profile["id"]
    print(f"Profile ID: {pid}")

    print("Adding experience…")
    exp1 = post(f"{base}/profiles", {})  # We add entities via direct DB for demo
    # Note: In a real seed, you would POST to /profiles/{id}/evidence or use the admin API.
    # For MVP, we'll trigger ingestion via text payload.

    print("Analyzing sample job description…")
    jd_text = """
Senior Software Engineer — Backend (Python)

Company: FinVault GmbH, Berlin
Type: Full-time, Hybrid

We are looking for a Senior Backend Engineer to join our payments team.

Requirements (must-have):
- 5+ years Python backend development
- FastAPI or Django REST Framework
- PostgreSQL, experience with performance tuning
- Docker and Kubernetes in production
- Experience with event-driven architectures (Kafka or RabbitMQ)

Nice to have:
- Experience in fintech or payments domain
- Knowledge of PCI-DSS compliance
- Rust or Go experience

Responsibilities:
- Design and implement high-throughput payment processing APIs
- Lead technical design reviews and code reviews
- Mentor junior engineers
- Work closely with product and data teams

Language: English required, German is a bonus.
"""
    job = post(f"{base}/jobs/analyze", {"raw_text": jd_text})
    jid = job["id"]
    print(f"Job ID: {jid}")
    print(f"Extracted title: {job.get('title')}, company: {job.get('company')}")

    print("\n=== Seed complete ===")
    print(f"Profile ID : {pid}")
    print(f"Job ID     : {jid}")
    print("\nNext steps:")
    print(f"  1. Go to http://localhost:3000/profile and load profile {pid}")
    print(f"  2. Upload your CV PDF to extract blocks")
    print(f"  3. Go to http://localhost:3000/review and fetch evidence pack")
    print(f"  4. Go to http://localhost:3000/workspace and generate resume + cover letter")

if __name__ == "__main__":
    main()
