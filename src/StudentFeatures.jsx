import { useEffect, useState } from "react";
import { ArrowRight, Award, BriefcaseBusiness, Check, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { api } from "./api.js";

export function StudentRecommendations({ setPage }) {
  const [data, setData] = useState({ courses: [], placements: [] });
  const [error, setError] = useState("");
  useEffect(() => {
    api("/recommendations").then(setData).catch((requestError) => setError(requestError.message));
  }, []);
  const items = [...data.courses, ...data.placements].slice(0, 4);
  return <section className="panel student-insights">
    <div className="panel-heading"><div><span className="eyebrow">CHOSEN FOR YOUR NEXT STEP</span><h3>Recommended for you</h3></div><Award size={18} /></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {items.length ? items.map((item) => <article className="recommendation-row" key={`${item.kind}-${item.id}`}>
      <span className="recommendation-icon">{item.kind === "placement" ? <BriefcaseBusiness size={16} /> : <Award size={16} />}</span>
      <span><strong>{item.title}</strong><small>{item.reason}</small></span>
      <button className="icon-button" aria-label={`Open ${item.title}`} onClick={() => setPage(item.target)}><ArrowRight size={15} /></button>
    </article>) : !error && <p className="empty-inline">Complete your skills and placement profile to get more relevant suggestions.</p>}
  </section>;
}

export function StudentPortfolio() {
  const [portfolio, setPortfolio] = useState({ headline: "", about: "", projects: [], sharingEnabled: false });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    api("/portfolio").then(setPortfolio).catch((requestError) => setError(requestError.message));
  }, []);

  function editProject(index, field, value) {
    setPortfolio((current) => ({ ...current, projects: current.projects.map((project, itemIndex) => itemIndex === index
      ? { ...project, [field]: field === "skills" ? value.split(",").map((skill) => skill.trim()).filter(Boolean) : value }
      : project) }));
  }

  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const saved = await api("/portfolio", { method: "PUT", body: JSON.stringify(portfolio) });
      setPortfolio((current) => ({ ...current, ...saved }));
      setNotice("Your student portfolio has been saved.");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function share() {
    setError(""); setNotice("");
    try {
      const result = await api("/portfolio/share", { method: "POST", body: "{}" });
      const url = `${window.location.origin}/portfolio/${result.shareToken}`;
      setShareUrl(url);
      setPortfolio((current) => ({ ...current, sharingEnabled: true }));
    } catch (requestError) { setError(requestError.message); }
  }

  async function revoke() {
    setError("");
    try {
      await api("/portfolio/share", { method: "DELETE", body: "{}" });
      setPortfolio((current) => ({ ...current, sharingEnabled: false }));
      setShareUrl("");
      setNotice("The public portfolio link has been revoked.");
    } catch (requestError) { setError(requestError.message); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); setNotice("Portfolio link copied."); }
    catch (copyError) { setError(`Could not copy the link: ${copyError.message}`); }
  }

  return <section className="panel student-portfolio">
    <div className="panel-heading"><div><span className="eyebrow">SHOW WHAT YOU CAN DO</span><h3>Student skill portfolio</h3></div><Award size={18} /></div>
    <p className="profile-email-note">Add projects and skills, then optionally create a private-link portfolio. Your account email, phone, and resume are never shared.</p>
    <form onSubmit={save}>
      <label>Portfolio headline<input maxLength="120" value={portfolio.headline} onChange={(event) => setPortfolio({ ...portfolio, headline: event.target.value })} placeholder="e.g. Full-stack developer in training" /></label>
      <label>About this portfolio<textarea maxLength="600" rows="3" value={portfolio.about} onChange={(event) => setPortfolio({ ...portfolio, about: event.target.value })} /></label>
      <div className="portfolio-project-heading"><strong>Projects ({portfolio.projects.length}/20)</strong><button className="button button-outline button-small" type="button" disabled={portfolio.projects.length >= 20} onClick={() => setPortfolio({ ...portfolio, projects: [...portfolio.projects, { id: crypto.randomUUID(), title: "", description: "", url: "", skills: [] }] })}><Plus size={13} /> Add project</button></div>
      {portfolio.projects.map((project, index) => <article className="portfolio-project-form" key={project.id || index}>
        <div className="portfolio-project-heading"><strong>Project {index + 1}</strong><button className="icon-button" type="button" aria-label="Remove project" onClick={() => setPortfolio({ ...portfolio, projects: portfolio.projects.filter((_item, itemIndex) => itemIndex !== index) })}><Trash2 size={14} /></button></div>
        <label>Project name<input maxLength="100" required value={project.title} onChange={(event) => editProject(index, "title", event.target.value)} /></label>
        <label>Description<textarea maxLength="500" rows="2" value={project.description} onChange={(event) => editProject(index, "description", event.target.value)} /></label>
        <label>Project link (optional)<input type="url" value={project.url} onChange={(event) => editProject(index, "url", event.target.value)} placeholder="https://…" /></label>
        <label>Skills (comma-separated)<input value={(project.skills || []).join(", ")} onChange={(event) => editProject(index, "skills", event.target.value)} /></label>
      </article>)}
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
      <div className="portfolio-actions"><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save portfolio"}<Check size={14} /></button>
        <button className="button button-outline" type="button" onClick={share}>{portfolio.sharingEnabled ? "Create new share link" : "Create share link"}<ExternalLink size={14} /></button>
        {portfolio.sharingEnabled && <button className="button button-outline" type="button" onClick={revoke}>Revoke link</button>}
      </div>
    </form>
    {shareUrl && <div className="portfolio-share-link"><a href={shareUrl} target="_blank" rel="noreferrer">{shareUrl}</a><button className="button button-outline button-small" onClick={copyLink}><Copy size={13} /> Copy</button></div>}
  </section>;
}

export function PublicPortfolio({ shareToken }) {
  const [portfolio, setPortfolio] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api(`/public/portfolio/${encodeURIComponent(shareToken)}`).then(setPortfolio).catch((requestError) => setError(requestError.message));
  }, [shareToken]);
  return <main className="public-portfolio-page">
    <span className="eyebrow">ZYNGRAM CAMPUS HUB · STUDENT PORTFOLIO</span>
    {error ? <section className="panel"><h1>Portfolio unavailable</h1><p>{error}</p></section> : !portfolio ? <section className="panel">Loading portfolio…</section> : <>
      <section className="panel public-portfolio-intro"><h1>{portfolio.name}</h1><h2>{portfolio.headline}</h2><p>{portfolio.about || "A collection of learning projects and skills."}</p><div className="portfolio-skills">{portfolio.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">LEARN BY BUILDING</span><h3>Projects</h3></div></div>
        {portfolio.projects.length ? <div className="public-project-grid">{portfolio.projects.map((project) => <article className="panel public-project" key={project.id}><h3>{project.title}</h3><p>{project.description}</p><div className="portfolio-skills">{project.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>{project.url && <a href={project.url} target="_blank" rel="noreferrer">View project <ExternalLink size={13} /></a>}</article>)}</div> : <p className="empty-inline">Projects will appear here when added.</p>}
      </section>
      {portfolio.achievements.length > 0 && <section className="panel"><div className="panel-heading"><div><span className="eyebrow">MILESTONES</span><h3>Achievements</h3></div></div><div className="portfolio-skills">{portfolio.achievements.map((achievement) => <span key={achievement}>{achievement}</span>)}</div></section>}
      {portfolio.certificates.length > 0 && <section className="panel"><div className="panel-heading"><div><span className="eyebrow">VERIFIED LEARNING MILESTONES</span><h3>Course certificates</h3></div></div>{portfolio.certificates.map((certificate) => <article className="profile-certificate-card" key={certificate.certificateId}><span className="portfolio-certificate"><Award size={17} /></span><span><strong>{certificate.course}</strong><small>Certificate ID {certificate.certificateId} · {new Date(certificate.issuedAt).toLocaleDateString()}</small></span></article>)}</section>}
    </>}
    <footer>Zyngram Campus Hub · Shared read-only portfolio</footer>
  </main>;
}
