import React from 'react';

export default function TrustMarquee() {
  const baseUrl = import.meta.env.BASE_URL || '/';

  const partners = [
    {
      name: 'Google Cloud',
      role: 'Enterprise Institutional Auth',
      logo: `${baseUrl}brands/google.png`,
    },
    {
      name: 'Firebase',
      role: 'Realtime Bench Telemetry & Firestore',
      logo: `${baseUrl}brands/firebase.png`,
    },
    {
      name: 'Google Gemini',
      role: 'Autonomous In-Silico Protocol Engine',
      logo: `${baseUrl}brands/gemini.png`,
    },
    {
      name: 'Cloudinary',
      role: 'Automated Raw Gel & Specimen CDN',
      logo: `${baseUrl}brands/cloudinary.png`,
    },
    {
      name: '21 CFR Part 11',
      role: 'Cryptographic Electronic Signatures',
      badge: 'GLP VALIDATED',
    },
    {
      name: 'ISO/IEC 17025',
      role: 'Laboratory Testing Competence Standard',
      badge: 'COMPLIANT',
    },
  ];

  const marqueeItems = [...partners, ...partners];

  return (
    <div className="w-full mt-10 pt-6 border-t border-emerald-950/40">
      <p className="text-[11px] font-mono tracking-widest text-emerald-400/70 text-center uppercase mb-4">
        Enterprise-Grade Infrastructure & Regulatory Bench Standards
      </p>

      <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
        <div className="flex w-max items-center gap-6 animate-marquee hover:[animation-play-state:paused] py-2">
          {marqueeItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/95 backdrop-blur-md shadow-sm border border-slate-200/40 flex-shrink-0"
            >
              {item.logo ? (
                <img
                  src={item.logo}
                  alt={item.name}
                  className="h-6 w-auto max-w-[100px] object-contain"
                />
              ) : (
                <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-600 text-white font-mono">
                  {item.badge}
                </span>
              )}
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 tracking-tight leading-tight">
                  {item.name}
                </span>
                <span className="text-[10px] text-slate-500 font-mono leading-tight">
                  {item.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 28s linear infinite;
        }
        .hover\\:\\[animation-play-state\\:paused\\]:hover {
          animation-play-state: paused;
        }
        /* Scoped utility styles ensuring pixel-perfect rendering */
        .w-full { width: 100%; }
        .mt-10 { margin-top: 2.5rem; }
        .pt-6 { padding-top: 1.5rem; }
        .border-t { border-top-width: 1px; border-top-style: solid; }
        .border-emerald-950\\/40 { border-color: rgba(2, 44, 34, 0.4); }
        .text-\\[11px\\] { font-size: 11px; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .tracking-widest { letter-spacing: 0.1em; }
        .text-emerald-400\\/70 { color: rgba(52, 211, 153, 0.7); }
        .text-center { text-align: center; }
        .uppercase { text-transform: uppercase; }
        .mb-4 { margin-bottom: 1rem; }
        .relative { position: relative; }
        .overflow-hidden { overflow: hidden; }
        .\\[mask-image\\:linear-gradient\\(to_right\\,transparent\\,black_15\\%\\,black_85\\%\\,transparent\\)\\] {
          -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
          mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
        }
        .flex { display: flex; }
        .w-max { width: max-content; }
        .items-center { align-items: center; }
        .gap-6 { gap: 1.5rem; }
        .gap-3 { gap: 0.75rem; }
        .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        .px-4 { padding-left: 1rem; padding-right: 1rem; }
        .rounded-xl { border-radius: 0.75rem; }
        .rounded { border-radius: 0.25rem; }
        .bg-white\\/95 { background-color: rgba(255, 255, 255, 0.95); }
        .backdrop-blur-md { backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
        .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
        .border { border-width: 1px; border-style: solid; }
        .border-slate-200\\/40 { border-color: rgba(226, 232, 240, 0.4); }
        .flex-shrink-0 { flex-shrink: 0; }
        .h-6 { height: 1.5rem; }
        .w-auto { width: auto; }
        .max-w-\\[100px\\] { max-width: 100px; }
        .object-contain { object-fit: contain; }
        .text-\\[10px\\] { font-size: 10px; }
        .font-bold { font-weight: 700; }
        .tracking-wider { letter-spacing: 0.05em; }
        .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
        .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
        .bg-emerald-600 { background-color: #059669; }
        .text-white { color: #ffffff; }
        .flex-col { flex-direction: column; }
        .text-left { text-align: left; }
        .text-xs { font-size: 0.75rem; line-height: 1rem; }
        .font-semibold { font-weight: 600; }
        .text-slate-900 { color: #0f172a; }
        .text-slate-500 { color: #64748b; }
        .tracking-tight { letter-spacing: -0.025em; }
        .leading-tight { line-height: 1.25; }
      `}</style>
    </div>
  );
}
