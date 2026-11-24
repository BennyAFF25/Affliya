'use client';
import React, { useState } from 'react';
import { starterKitAudience, starterKitDonts, starterKitDos, starterKitFaq, starterKitPitch, starterKitSteps, starterKitTemplates } from '../../../utils/growthPartners/starterKit';

function CopyTemplate({ id, title, hint, body, disabled }: { id: string; title: string; hint: string; body: string; disabled: boolean }) {
  const [status, setStatus] = useState('');
  return (
    <article className="gp-template" aria-labelledby={`${id}-title`}>
      <div className="gp-template-head">
        <div><h4 id={`${id}-title`}>{title}</h4><p className="gp-template-hint">{hint}</p></div>
        <button type="button" className="gp-copy" disabled={disabled} aria-label={`Copy ${title} template`} aria-describedby={`${id}-status`} onClick={async () => {
          try { await navigator.clipboard.writeText(body); setStatus('Copied to clipboard.'); }
          catch { setStatus('Copy unavailable. Select the text and copy it.'); }
        }}>{status === 'Copied to clipboard.' ? 'Copied' : 'Copy'}</button>
      </div>
      <pre className="gp-template-body" tabIndex={0} aria-label={`${title} template text`}>{body}</pre>
      <p id={`${id}-status`} role="status" aria-live="polite" className="gp-template-status">{status}</p>
    </article>
  );
}

export default function StarterKit({ referralUrl }: { referralUrl: string | null }) {
  const templates = starterKitTemplates(referralUrl);
  return (
    <section id="starter-kit" className="gp-card gp-kit scroll-mt-6" aria-labelledby="starter-kit-title">
      <p className="gp-eyebrow">Partner starter kit</p>
      <h2 id="starter-kit-title">Your starter kit</h2>
      <p>Everything you need to start bringing in referrals: how it works, who to approach, what to say and the ground rules.</p>

      <h3 className="gp-kit-heading">How the programme works</h3>
      <ol className="gp-steps">
        {starterKitSteps.map((step, index) => <li key={step.title} className="gp-step"><span className="gp-step-number" aria-hidden="true">{index + 1}</span><div><h4>{step.title}</h4><p>{step.body}</p></div></li>)}
      </ol>

      <div className="gp-kit-columns">
        <div className="gp-metric"><h3>Who to target</h3><ul className="gp-bullets">{starterKitAudience.map(item => <li key={item}>{item}</li>)}</ul></div>
        <div className="gp-metric"><h3>{starterKitPitch.headline}</h3><ul className="gp-bullets">{starterKitPitch.points.map(item => <li key={item}>{item}</li>)}</ul></div>
      </div>

      <h3 className="gp-kit-heading">Ready-to-send templates</h3>
      <p className="text-sm">{referralUrl ? 'Your referral link is already included. Replace the [bracketed] parts before sending.' : 'Copying is unavailable while your referral link is suspended.'}</p>
      <div className="gp-templates">{templates.map(template => <CopyTemplate key={template.id} {...template} disabled={!referralUrl} />)}</div>

      <div className="gp-kit-columns">
        <div className="gp-metric"><h3>Do</h3><ul className="gp-bullets gp-do">{starterKitDos.map(item => <li key={item}>{item}</li>)}</ul></div>
        <div className="gp-metric"><h3>Don’t</h3><ul className="gp-bullets gp-dont">{starterKitDonts.map(item => <li key={item}>{item}</li>)}</ul></div>
      </div>

      <h3 className="gp-kit-heading">Quick answers</h3>
      <div className="gp-faq">{starterKitFaq.map(item => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div>
    </section>
  );
}
