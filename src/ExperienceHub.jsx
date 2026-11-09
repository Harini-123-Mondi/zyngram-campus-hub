import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Check, ChevronRight, Plus, Search, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { api } from "./api.js";

const emptyValues = (feature) => Object.fromEntries(feature.fields.map((field) => [field.id, ""]));
const fieldValue = (field, value) => field.type === "number" && value !== "" ? Number(value) : value;

export default function ExperienceHub({ user }) {
  const [features, setFeatures] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [category, setCategory] = useState("All");
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState("");
  const [formValues, setFormValues] = useState({});
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loadingFeatures, setLoadingFeatures] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const recordRequest = useRef(0);

  useEffect(() => {
    api("/experience/features").then((items) => {
      setFeatures(items);
      setSelectedId(items[0]?.id || "");
    }).catch((requestError) => setError(requestError.message))
      .finally(() => setLoadingFeatures(false));
  }, []);

  const selected = features.find((feature) => feature.id === selectedId);
  const categories = useMemo(() => ["All", ...new Set(features.map((feature) => feature.category))], [features]);
  const visibleFeatures = features.filter((feature) => category === "All" || feature.category === category);
  const filteredRecords = records.filter((record) => JSON.stringify(record.fields).toLowerCase().includes(query.toLowerCase()));

  async function loadRecords(featureId) {
    if (!featureId) return;
    const requestId = ++recordRequest.current;
    setLoadingRecords(true);
    setError("");
    try {
      const items = await api(`/experience/records/${encodeURIComponent(featureId)}`);
      if (requestId === recordRequest.current) setRecords(items);
    } catch (requestError) {
      if (requestId === recordRequest.current) {
        setError(requestError.message);
        setRecords([]);
      }
    } finally {
      if (requestId === recordRequest.current) setLoadingRecords(false);
    }
  }

  useEffect(() => {
    loadRecords(selectedId);
    setFormOpen(false);
    setEditing(null);
    setNotice("");
    setQuery("");
    return () => { recordRequest.current += 1; };
  }, [selectedId]);

  function startCreate() {
    setEditing(null);
    setFormValues(emptyValues(selected));
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  function startEdit(record) {
    setEditing(record);
    setFormValues({ ...emptyValues(selected), ...record.fields });
    setFormOpen(true);
    setError("");
    setNotice("");
  }

  async function saveRecord(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const fields = Object.fromEntries(selected.fields
      .filter((field) => formValues[field.id] !== "")
      .map((field) => [field.id, fieldValue(field, formValues[field.id])]));
    try {
      const path = `/experience/records/${encodeURIComponent(selected.id)}${editing ? `/${encodeURIComponent(editing.id)}` : ""}`;
      await api(path, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({ fields })
      });
      setFormOpen(false);
      setEditing(null);
      setNotice(editing ? "Your update has been saved." : "Your item has been added.");
      await loadRecords(selected.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(record) {
    if (!window.confirm(`Delete "${record.fields.title}"? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    try {
      await api(`/experience/records/${encodeURIComponent(selected.id)}/${encodeURIComponent(record.id)}`, { method: "DELETE" });
      setNotice("The item has been deleted.");
      await loadRecords(selected.id);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loadingFeatures) return <main className="page-content"><p className="experience-loading">Loading your campus tools…</p></main>;
  if (!features.length) return <main className="page-content"><p className="global-error">{error || "No campus tools are available right now."}</p></main>;

  return <main className="page-content experience-hub">
    <header className="experience-hero">
      <div className="experience-hero-icon"><BriefcaseBusiness size={22} /></div>
      <div>
        <span className="eyebrow">YOUR NEXT STEP STARTS HERE</span>
        <h1>Career & campus tools</h1>
        <p>Build your skills, share your work, and stay connected to opportunities across campus.</p>
      </div>
    </header>

    {error && <div className="experience-message experience-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
    {notice && <div className="experience-message experience-success" role="status"><Check size={15} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15} /></button></div>}

    <section className="experience-browse">
      <div className="experience-section-heading">
        <div><span className="eyebrow">EXPLORE</span><h2>Tools to move forward</h2></div>
        <span className="experience-count">{features.length} tools</span>
      </div>
      <div className="experience-categories" aria-label="Filter tools by category">
        {categories.map((item) => <button key={item} className={category === item ? "experience-category active" : "experience-category"} onClick={() => {
          setCategory(item);
          const nextFeatures = item === "All" ? features : features.filter((feature) => feature.category === item);
          if (!nextFeatures.some((feature) => feature.id === selectedId)) setSelectedId(nextFeatures[0]?.id || "");
        }}>{item}</button>)}
      </div>
      <div className="experience-feature-grid">
        {visibleFeatures.map((feature) => <button
          key={feature.id}
          className={`experience-feature-card ${selectedId === feature.id ? "selected" : ""}`}
          onClick={() => setSelectedId(feature.id)}
          aria-pressed={selectedId === feature.id}
        >
          <span className="experience-feature-symbol"><ChevronRight size={17} /></span>
          <span className="experience-feature-copy"><strong>{feature.title}</strong><small>{feature.description}</small></span>
          {selectedId === feature.id && <Check size={16} className="experience-selected-check" />}
        </button>)}
      </div>
    </section>

    {selected && <section className="experience-workspace">
      <div className="experience-section-heading">
        <div><span className="eyebrow">{selected.category}</span><h2>{selected.title}</h2><p>{selected.description}</p></div>
        {selected.canCreate && <button className="button button-primary" onClick={startCreate}><Plus size={16} /> Add an item</button>}
      </div>
      {!selected.canCreate && <p className="experience-readonly">This tool is managed by your campus team. You can view shared items here.</p>}

      {formOpen && <form className="experience-form" onSubmit={saveRecord}>
        <div className="experience-form-header"><strong>{editing ? "Update item" : "Add a new item"}</strong><button type="button" className="icon-button" onClick={() => setFormOpen(false)} aria-label="Close form"><X size={17} /></button></div>
        <div className="experience-form-grid">
          {selected.fields.map((field) => <label key={field.id} className={field.type === "textarea" ? "experience-field-wide" : ""}>
            <span>{field.label}{field.required && <i aria-hidden="true"> *</i>}</span>
            {field.type === "textarea"
              ? <textarea required={field.required} maxLength={field.maxLength} rows={3} value={formValues[field.id] ?? ""} onChange={(event) => setFormValues({ ...formValues, [field.id]: event.target.value })} />
              : field.type === "select"
                ? <select required={field.required} value={formValues[field.id] ?? ""} onChange={(event) => setFormValues({ ...formValues, [field.id]: event.target.value })}>
                  <option value="">Choose an option</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                : <input
                  type={field.type === "email" ? "email" : field.type}
                  required={field.required}
                  maxLength={field.maxLength}
                  min={field.type === "number" ? field.min : undefined}
                  max={field.type === "number" ? field.max : undefined}
                  step={field.type === "number" ? "any" : undefined}
                  value={formValues[field.id] ?? ""}
                  onChange={(event) => setFormValues({ ...formValues, [field.id]: event.target.value })}
                />}
          </label>)}
        </div>
        <div className="experience-form-actions"><button type="button" className="button button-outline" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add item"}</button></div>
      </form>}

      <div className="experience-record-toolbar">
        <div className="experience-record-title"><Users size={16} /><strong>Your items & campus posts</strong><span>{filteredRecords.length}</span></div>
        <label className="experience-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search items" aria-label="Search items" /></label>
      </div>
      {loadingRecords ? <p className="experience-loading">Loading items…</p> : filteredRecords.length ? <div className="experience-record-list">
        {filteredRecords.map((record) => {
          const canEdit = record.ownerId === user.id || user.role === "administrator";
          const details = Object.entries(record.fields).filter(([key, value]) => key !== "title" && value !== undefined && value !== "");
          return <article className="experience-record" key={record.id}>
            <div className="experience-record-main">
              <div className="experience-record-name"><h3>{record.fields.title}</h3>{record.fields.status && <span className="experience-status">{record.fields.status}</span>}</div>
              <p>{details.slice(0, 3).map(([key, value]) => `${key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}: ${value}`).join(" · ") || "No additional details yet."}</p>
              {selected.publicListing && <small className="experience-owner">Shared by {canEdit ? "you" : record.ownerName}</small>}
            </div>
            {canEdit && <div className="experience-record-actions"><button className="button button-outline" onClick={() => startEdit(record)}>Edit</button><button className="icon-button experience-delete" onClick={() => deleteRecord(record)} title="Delete item" aria-label={`Delete ${record.fields.title}`}><Trash2 size={16} /></button></div>}
          </article>;
        })}
      </div> : <div className="experience-empty"><span><ArrowRight size={19} /></span><strong>{query ? "No matching items" : "Nothing here yet"}</strong><p>{query ? "Try another search." : selected.canCreate ? "Add your first item to start tracking progress here." : "Shared campus items will appear here when available."}</p></div>}
      {!selected.publicListing && <p className="experience-privacy"><ShieldCheck size={14} /> Your entries in this tool are private to your account.</p>}
    </section>}
  </main>;
}
