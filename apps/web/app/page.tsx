import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-8 pt-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Career Copilot</h1>
        <p className="text-gray-500 text-lg">
          Evidence-grounded resume and cover letter generation — no hallucinations, full traceability.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            href: "/profile",
            title: "1. Build Your Profile",
            desc: "Upload your CV or fill in your career blocks. Everything is stored as structured, reusable evidence.",
            color: "border-indigo-400",
          },
          {
            href: "/jobs",
            title: "2. Analyze a Job",
            desc: "Paste or upload a job description. We extract skills, responsibilities, and keywords automatically.",
            color: "border-teal-400",
          },
          {
            href: "/review",
            title: "3. Review Evidence",
            desc: "See which profile blocks are most relevant. Include or exclude evidence before generation.",
            color: "border-amber-400",
          },
          {
            href: "/workspace",
            title: "4. Generate & Export",
            desc: "Generate a tailored resume, cover letter, and fit analysis. Validate and export to PDF.",
            color: "border-rose-400",
          },
        ].map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`rounded-xl border-l-4 ${card.color} bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2`}
          >
            <h2 className="font-semibold text-gray-800">{card.title}</h2>
            <p className="text-sm text-gray-500 leading-relaxed">{card.desc}</p>
          </Link>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>Local development mode.</strong> No authentication — all data is local.
        Set <code className="font-mono bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code> in your <code className="font-mono bg-amber-100 px-1 rounded">.env</code> to enable generation.
      </div>
    </div>
  );
}
