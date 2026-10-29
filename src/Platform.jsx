import { useEffect, useState } from "react";
import { api } from "./api.js";
import {
  ArrowRight, Award, BookOpen, BriefcaseBusiness, Building2, CalendarDays, Check, CircleAlert,
  CircleCheck, Clock3, Code2, Download, FileCheck2, FileText, KeyRound, MessageCircle, Plus,
  Search, Send, ShieldCheck, Sparkles, Trash2, Users
} from "lucide-react";

function Heading({ eyebrow, title, subtitle }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></div>;
}

function FormNotice({ error, notice }) {
  return <>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}</>;
}

function StatusTag({ children, tone = "default" }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function Empty({ icon: Icon, title, text }) {
  return <div className="empty-state"><span><Icon size={22} /></span><strong>{title}</strong><p>{text}</p></div>;
}

function useLoad(path, initial) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function reload() {
    setError("");
    try { setData(await api(path)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, [path]);
  return { data, setData, error, loading, reload };
}

const placementStatusOptions = ["applied", "under_review", "shortlisted", "interview_scheduled", "selected", "not_selected", "withdrawn"];
const displayStatus = (value = "") => value.replaceAll("_", " ");

function PlacementCompanyCard({ company, onSave }) {
  return <article className="placement-record-card"><div className="trainer-material-row"><span><strong>{company.name}</strong><small>{company.industry} · {company.recruiterName || "Recruiter contact not added"} · {company.recruiterEmail || "No email"}</small></span>{company.website && <a href={company.website} target="_blank" rel="noreferrer">Website</a>}<StatusTag tone={company.status === "active" ? "green" : "orange"}>{company.status}</StatusTag><button className="button button-outline button-small" onClick={() => onSave({ ...company, status: company.status === "active" ? "inactive" : "active" })}>{company.status === "active" ? "Deactivate" : "Activate"}</button></div><details className="placement-edit-details"><summary>Edit company details</summary><form className="platform-form-grid" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ ...company, name: form.get("name"), industry: form.get("industry"), website: form.get("website"), recruiterName: form.get("recruiterName"), recruiterEmail: form.get("recruiterEmail"), recruiterPhone: form.get("recruiterPhone"), notes: form.get("notes") }); }}><label>Company<input name="name" defaultValue={company.name} required /></label><label>Industry<input name="industry" defaultValue={company.industry} required /></label><label>Website<input name="website" defaultValue={company.website} /></label><label>Recruiter<input name="recruiterName" defaultValue={company.recruiterName} /></label><label>Recruiter email<input name="recruiterEmail" defaultValue={company.recruiterEmail} /></label><label>Phone<input name="recruiterPhone" defaultValue={company.recruiterPhone} /></label><label className="platform-form-wide">Notes<textarea name="notes" defaultValue={company.notes} /></label><button className="button button-outline button-small">Save company changes <Check size={13} /></button></form></details></article>;
}

function PlacementJobCard({ job, companies, onSave, onStatus }) {
  return <article className="placement-record-card"><div className="trainer-material-row"><span><strong>{job.title}</strong><small>{job.companyName} · {job.location} · CGPA {job.minCgpa}+ · closes {job.deadline}</small></span><StatusTag tone={job.status === "published" ? "green" : "orange"}>{job.status}</StatusTag><select aria-label={`Posting status for ${job.title}`} value={job.status} onChange={(event) => onStatus(event.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select></div><details className="placement-edit-details"><summary>Edit posting details</summary><form className="platform-form-grid" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ companyId: form.get("companyId"), title: form.get("title"), description: form.get("description"), skills: String(form.get("skills")).split(",").map((skill) => skill.trim()).filter(Boolean), minCgpa: Number(form.get("minCgpa")), location: form.get("location"), workMode: form.get("workMode"), packageText: form.get("packageText"), deadline: form.get("deadline"), positions: Number(form.get("positions")), type: form.get("type"), status: form.get("status") }); }}><label>Company<select name="companyId" defaultValue={job.companyId} required>{companies.filter((company) => company.status === "active").map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label><label>Title<input name="title" defaultValue={job.title} required /></label><label>Skills<input name="skills" defaultValue={job.skills.join(", ")} /></label><label>Minimum CGPA<input name="minCgpa" type="number" min="0" max="10" step=".1" defaultValue={job.minCgpa} required /></label><label>Location<input name="location" defaultValue={job.location} required /></label><label>Work mode<select name="workMode" defaultValue={job.workMode}><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label><label>Package<input name="packageText" defaultValue={job.packageText} /></label><label>Deadline<input name="deadline" type="date" defaultValue={job.deadline} required /></label><label>Positions<input name="positions" type="number" min="1" defaultValue={job.positions} required /></label><label>Type<select name="type" defaultValue={job.type}><option>Full time</option><option>Internship</option><option>Part time</option></select></label><label>Status<select name="status" defaultValue={job.status}><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select></label><label className="platform-form-wide">Description<textarea name="description" defaultValue={job.description} required /></label><button className="button button-outline button-small">Save job changes <Check size={13} /></button></form></details></article>;
}

function PlacementDriveCard({ drive, companies, jobs, onSave, onStatus }) {
  return <article className="placement-record-card"><div className="trainer-material-row"><span><strong>{drive.roleTitle} · {drive.companyName}</strong><small>{drive.driveDate} · {drive.venue} · registration {drive.registrationStart} – {drive.registrationEnd}</small></span><StatusTag>{drive.status}</StatusTag><select aria-label={`Drive status for ${drive.roleTitle}`} value={drive.status} onChange={(event) => onStatus(event.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div><details className="placement-edit-details"><summary>Edit drive details</summary><form className="platform-form-grid" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ companyId: form.get("companyId"), jobId: form.get("jobId"), roleTitle: form.get("roleTitle"), registrationStart: form.get("registrationStart"), registrationEnd: form.get("registrationEnd"), driveDate: form.get("driveDate"), venue: form.get("venue"), selectionProcess: String(form.get("selectionProcess")).split(",").map((stage) => stage.trim()).filter(Boolean), minCgpa: Number(form.get("minCgpa")), status: form.get("status") }); }}><label>Company<select name="companyId" defaultValue={drive.companyId} required>{companies.filter((company) => company.status === "active").map((company) => <option value={company.id} key={company.id}>{company.name}</option>)}</select></label><label>Linked job<select name="jobId" defaultValue={drive.jobId || ""}><option value="">No linked job</option>{jobs.map((job) => <option value={job.id} key={job.id}>{job.title}</option>)}</select></label><label>Role title<input name="roleTitle" defaultValue={drive.roleTitle} required /></label><label>Registration opens<input name="registrationStart" type="date" defaultValue={drive.registrationStart} required /></label><label>Registration closes<input name="registrationEnd" type="date" defaultValue={drive.registrationEnd} required /></label><label>Drive date<input name="driveDate" type="date" defaultValue={drive.driveDate} required /></label><label>Venue<input name="venue" defaultValue={drive.venue} required /></label><label>Selection stages<input name="selectionProcess" defaultValue={drive.selectionProcess.join(", ")} /></label><label>Minimum CGPA<input name="minCgpa" type="number" min="0" max="10" step=".1" defaultValue={drive.minCgpa} required /></label><label>Status<select name="status" defaultValue={drive.status}><option value="draft">Draft</option><option value="published">Published</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><button className="button button-outline button-small">Save drive changes <Check size={13} /></button></form></details></article>;
}

export function PlacementOfficerPage({ section, setPage }) {
  const { data: students, loading: studentsLoading, error: studentsError, reload: reloadStudents } = useLoad("/placement/students", []);
  const { data: companies, loading: companiesLoading, error: companiesError, reload: reloadCompanies } = useLoad("/placement/companies", []);
  const { data: jobs, loading: jobsLoading, error: jobsError, reload: reloadJobs } = useLoad("/placement/jobs", []);
  const { data: drives, loading: drivesLoading, error: drivesError, reload: reloadDrives } = useLoad("/placement/drives", []);
  const { data: applications, loading: applicationsLoading, error: applicationsError, reload: reloadApplications } = useLoad("/placement/applications", []);
  const { data: interviews, loading: interviewsLoading, error: interviewsError, reload: reloadInterviews } = useLoad("/placement/interviews", []);
  const { data: offers, loading: offersLoading, error: offersError, reload: reloadOffers } = useLoad("/placement/offers", []);
  const { data: report, loading: reportLoading, error: reportError } = useLoad("/placement/reports", null);
  const [search, setSearch] = useState("");
  const [eligibility, setEligibility] = useState("all");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: "", industry: "", website: "", recruiterName: "", recruiterEmail: "", recruiterPhone: "", notes: "" });
  const [jobForm, setJobForm] = useState({ companyId: "", title: "", description: "", skills: "", minCgpa: "6", location: "", workMode: "Hybrid", packageText: "", deadline: "", positions: "1", type: "Full time", status: "draft" });
  const [driveForm, setDriveForm] = useState({ companyId: "", jobId: "", roleTitle: "", registrationStart: "", registrationEnd: "", driveDate: "", venue: "", selectionProcess: "Aptitude, Technical, HR", minCgpa: "6", status: "draft" });
  const [interviewForm, setInterviewForm] = useState({ applicationId: "", scheduledAt: "", roundType: "Technical", venue: "", meetingLink: "" });
  const [offerForm, setOfferForm] = useState({ applicationId: "", packageText: "", joiningDate: "" });
  const reloadSection = async () => {
    const reloaders = {
      placementStudents: reloadStudents, placementCompanies: reloadCompanies, placementJobs: reloadJobs,
      placementDrives: reloadDrives, placementApplications: reloadApplications, placementInterviews: reloadInterviews,
      placementOffers: reloadOffers
    };
    if (reloaders[section]) await reloaders[section]();
  };
  async function submit(endpoint, method, body, success, reload = reloadSection) {
    setBusy(true); setNotice(""); setError("");
    try { await api(endpoint, { method, body: JSON.stringify(body) }); await reload(); setNotice(success); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const activeApplications = applications.filter((item) => !["withdrawn", "not_selected"].includes(item.status));
  const visibleStudents = students.filter((student) => (eligibility === "all" || student.eligibility === eligibility)
    && `${student.name} ${student.studentId} ${student.email} ${student.course} ${student.skills.join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  const errors = [studentsError, companiesError, jobsError, drivesError, applicationsError, interviewsError, offersError, reportError].filter(Boolean);
  const heading = {
    placementStudents: ["STUDENT PLACEMENT PROFILES", "Know the talent, <em>respect the privacy.</em>", "Search student skills, check eligibility, review career details, and access resumes only for placement work."],
    placementCompanies: ["RECRUITER RELATIONSHIPS", "Build lasting <em>company partnerships.</em>", "Keep company contacts, industry information, and hiring history organized."],
    placementJobs: ["JOBS & INTERNSHIPS", "Bring the right roles <em>to your students.</em>", "Create opportunities with clear eligibility, deadlines, locations, and publishing status."],
    placementDrives: ["PLACEMENT DRIVE MANAGEMENT", "Make every drive <em>easy to follow.</em>", "Schedule company drives, publish registration windows, and share selection stages."],
    placementApplications: ["APPLICATIONS & SHORTLISTING", "Move each application <em>forward fairly.</em>", "Review candidates, record decisions, and send relevant status notifications."],
    placementInterviews: ["INTERVIEW SCHEDULING", "Make the next conversation <em>count.</em>", "Schedule, reschedule, and record candidate attendance for interview rounds."],
    placementOffers: ["SELECTION & OFFERS", "Verify results, <em>celebrate progress.</em>", "Record official offers and follow acceptance and joining status."],
    placementReports: ["PLACEMENT REPORTS & ANALYTICS", "See the outcomes, <em>not just activity.</em>", "Track unique placed students, eligibility, company selections, applications, and offer conversion."],
    placementResources: ["RESUME & CAREER PREPARATION", "Help learners show up <em>ready.</em>", "Review student resumes and point candidates to trusted preparation resources."]
  }[section] || ["PLACEMENT WORKSPACE", "Your placement team, <em>in sync.</em>", "Manage student opportunities and hiring workflows."];
  return <div className="page-content platform-page placement-workspace">
    <Heading eyebrow={heading[0]} title={<span dangerouslySetInnerHTML={{ __html: heading[1] }} />} subtitle={heading[2]} />
    {errors.map((message) => <FormNotice error={message} key={message} />)}
    <FormNotice error={error} notice={notice} />
    {section === "placementJobs" && jobs.length > 0 && <section className="panel"><div className="panel-heading"><div><span className="eyebrow">POSTING MAINTENANCE</span><h3>Edit opportunity details</h3></div><BriefcaseBusiness size={18} /></div>{jobs.map((job) => <PlacementJobCard key={job.id} job={job} companies={companies} onSave={(body) => submit(`/placement/jobs/${job.id}`, "PATCH", body, "Opportunity details saved.", reloadJobs)} onStatus={(status) => submit(`/placement/jobs/${job.id}`, "PATCH", { status }, "Posting status updated.", reloadJobs)} />)}</section>}
    {section === "placementDrives" && drives.length > 0 && <section className="panel"><div className="panel-heading"><div><span className="eyebrow">DRIVE MAINTENANCE</span><h3>Edit drive details</h3></div><CalendarDays size={18} /></div>{drives.map((drive) => <PlacementDriveCard key={drive.id} drive={drive} companies={companies} jobs={jobs} onSave={(body) => submit(`/placement/drives/${drive.id}`, "PATCH", body, "Drive details saved.", reloadDrives)} onStatus={(status) => submit(`/placement/drives/${drive.id}`, "PATCH", { status }, "Drive status updated.", reloadDrives)} />)}</section>}
    {section === "placementStudents" && <section className="panel"><div className="admin-user-filters"><label><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ZIN ID, course, or skill" /></label><select aria-label="Filter by eligibility" value={eligibility} onChange={(event) => setEligibility(event.target.value)}><option value="all">All eligibility</option><option value="eligible">Eligible</option><option value="ineligible">Not eligible</option><option value="pending">Profile incomplete</option></select></div>{studentsLoading ? <p>Loading placement profiles…</p> : <div className="table-wrap"><table><thead><tr><th>STUDENT</th><th>COURSE · GRAD YEAR</th><th>SKILLS · CGPA</th><th>ELIGIBILITY</th><th>PLACEMENT</th><th>RESUME</th></tr></thead><tbody>{visibleStudents.map((student) => <tr key={student.id}><td><strong>{student.name}</strong><small>{student.studentId} · {student.email}</small></td><td>{student.course}<small>{student.graduationYear || "Year not provided"}</small></td><td>{student.skills.join(", ") || "Skills not added"}<small>{student.cgpa === null ? "CGPA not provided" : `${student.cgpa.toFixed(2)} / 10`}</small></td><td><StatusTag tone={student.eligibility === "eligible" ? "green" : student.eligibility === "ineligible" ? "orange" : "default"}>{displayStatus(student.eligibility)}</StatusTag></td><td><select aria-label={`Placement status for ${student.name}`} value={student.placementStatus} onChange={(event) => submit(`/placement/students/${student.id}`, "PATCH", { placementStatus: event.target.value }, "Student placement status saved.", reloadStudents)}><option value="seeking">Seeking</option><option value="placed">Placed</option><option value="not_seeking">Not seeking</option></select></td><td>{student.resumeAvailable ? <a className="button button-outline button-small" href={`/api/placement/students/${student.id}/resume`}><Download size={13} /> PDF</a> : <small>Not uploaded</small>}</td></tr>)}</tbody></table>{!visibleStudents.length && <p className="trainer-empty-note">No students match those filters.</p>}</div>}</section>}
    {section === "placementCompanies" && <><form className="panel platform-form" onSubmit={(event) => { event.preventDefault(); submit("/placement/companies", "POST", companyForm, "Company added.", async () => { await reloadCompanies(); setCompanyForm({ name: "", industry: "", website: "", recruiterName: "", recruiterEmail: "", recruiterPhone: "", notes: "" }); }); }}>
      <div className="panel-heading"><div><span className="eyebrow">COMPANY PARTNER</span><h3>Add a company</h3></div><Building2 size={18} /></div>
      <div className="platform-form-grid"><label>Company name<input maxLength="120" value={companyForm.name} onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })} required /></label><label>Industry<input maxLength="80" value={companyForm.industry} onChange={(event) => setCompanyForm({ ...companyForm, industry: event.target.value })} required /></label><label>Website (HTTPS)<input type="url" value={companyForm.website} onChange={(event) => setCompanyForm({ ...companyForm, website: event.target.value })} /></label><label>Recruiter name<input maxLength="100" value={companyForm.recruiterName} onChange={(event) => setCompanyForm({ ...companyForm, recruiterName: event.target.value })} /></label><label>Recruiter email<input type="email" value={companyForm.recruiterEmail} onChange={(event) => setCompanyForm({ ...companyForm, recruiterEmail: event.target.value })} /></label><label>Recruiter phone<input maxLength="32" value={companyForm.recruiterPhone} onChange={(event) => setCompanyForm({ ...companyForm, recruiterPhone: event.target.value })} /></label></div>
      <label>Notes<textarea maxLength="1000" value={companyForm.notes} onChange={(event) => setCompanyForm({ ...companyForm, notes: event.target.value })} /></label><button className="button button-primary" disabled={busy}>Add company <Plus size={14} /></button>
    </form>
    <section className="panel">{companiesLoading ? <p>Loading companies…</p> : companies.map((company) => <PlacementCompanyCard key={company.id} company={company} onSave={(body) => submit(`/placement/companies/${company.id}`, "PATCH", body, "Company details saved.", reloadCompanies)} />)}{!companiesLoading && !companies.length && <p className="trainer-empty-note">Add a company to start managing hiring relationships.</p>}</section></>}
    {section === "placementJobs" && <><form className="panel platform-form" onSubmit={(event) => { event.preventDefault(); submit("/placement/jobs", "POST", { ...jobForm, minCgpa: Number(jobForm.minCgpa), positions: Number(jobForm.positions), skills: jobForm.skills.split(",").map((skill) => skill.trim()).filter(Boolean) }, "Job posting saved.", async () => { await reloadJobs(); setJobForm({ companyId: "", title: "", description: "", skills: "", minCgpa: "6", location: "", workMode: "Hybrid", packageText: "", deadline: "", positions: "1", type: "Full time", status: "draft" }); }); }}><div className="panel-heading"><div><span className="eyebrow">NEW OPPORTUNITY</span><h3>Create job or internship</h3></div><BriefcaseBusiness size={18} /></div><div className="platform-form-grid"><label>Company<select value={jobForm.companyId} onChange={(event) => setJobForm({ ...jobForm, companyId: event.target.value })} required><option value="">Choose company</option>{companies.filter((company) => company.status === "active").map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label>Role title<input maxLength="120" value={jobForm.title} onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })} required /></label><label>Opportunity type<select value={jobForm.type} onChange={(event) => setJobForm({ ...jobForm, type: event.target.value })}><option>Full time</option><option>Internship</option><option>Part time</option></select></label><label>Required skills (comma-separated)<input value={jobForm.skills} onChange={(event) => setJobForm({ ...jobForm, skills: event.target.value })} placeholder="Java, React, SQL" /></label><label>Minimum CGPA<input type="number" min="0" max="10" step=".1" value={jobForm.minCgpa} onChange={(event) => setJobForm({ ...jobForm, minCgpa: event.target.value })} required /></label><label>Location<input maxLength="120" value={jobForm.location} onChange={(event) => setJobForm({ ...jobForm, location: event.target.value })} required /></label><label>Work mode<select value={jobForm.workMode} onChange={(event) => setJobForm({ ...jobForm, workMode: event.target.value })}><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label><label>Package / stipend<input maxLength="80" value={jobForm.packageText} onChange={(event) => setJobForm({ ...jobForm, packageText: event.target.value })} placeholder="Optional · only when verified" /></label><label>Application deadline<input type="date" value={jobForm.deadline} onChange={(event) => setJobForm({ ...jobForm, deadline: event.target.value })} required /></label><label>Positions<input type="number" min="1" max="10000" value={jobForm.positions} onChange={(event) => setJobForm({ ...jobForm, positions: event.target.value })} required /></label><label>Post status<select value={jobForm.status} onChange={(event) => setJobForm({ ...jobForm, status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option></select></label></div><label>Description<textarea maxLength="2000" rows="3" value={jobForm.description} onChange={(event) => setJobForm({ ...jobForm, description: event.target.value })} required /></label><button className="button button-primary" disabled={busy || !companies.length}>Save posting <Plus size={14} /></button></form><section className="panel">{jobsLoading ? <p>Loading job postings…</p> : jobs.map((job) => <article className="trainer-material-row" key={job.id}><span><strong>{job.title}</strong><small>{job.companyName} · {job.location} · CGPA {job.minCgpa}+ · closes {job.deadline}</small></span><StatusTag tone={job.status === "published" ? "green" : "orange"}>{job.status}</StatusTag><select aria-label={`Posting status for ${job.title}`} value={job.status} onChange={(event) => submit(`/placement/jobs/${job.id}`, "PATCH", { status: event.target.value }, "Posting status updated.", reloadJobs)}><option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option></select></article>)}{!jobsLoading && !jobs.length && <p className="trainer-empty-note">No placement postings created yet.</p>}</section></>}
    {section === "placementDrives" && <><form className="panel platform-form" onSubmit={(event) => { event.preventDefault(); submit("/placement/drives", "POST", { ...driveForm, minCgpa: Number(driveForm.minCgpa), selectionProcess: driveForm.selectionProcess.split(",").map((stage) => stage.trim()).filter(Boolean) }, "Placement drive saved.", async () => { await reloadDrives(); setDriveForm({ companyId: "", jobId: "", roleTitle: "", registrationStart: "", registrationEnd: "", driveDate: "", venue: "", selectionProcess: "Aptitude, Technical, HR", minCgpa: "6", status: "draft" }); }); }}><div className="panel-heading"><div><span className="eyebrow">RECRUITMENT EVENT</span><h3>Schedule placement drive</h3></div><CalendarDays size={18} /></div><div className="platform-form-grid"><label>Company<select value={driveForm.companyId} onChange={(event) => setDriveForm({ ...driveForm, companyId: event.target.value })} required><option value="">Choose company</option>{companies.filter((company) => company.status === "active").map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label>Linked job (optional)<select value={driveForm.jobId} onChange={(event) => setDriveForm({ ...driveForm, jobId: event.target.value })}><option value="">No linked posting</option>{jobs.filter((job) => job.companyId === driveForm.companyId).map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label><label>Role title<input maxLength="120" value={driveForm.roleTitle} onChange={(event) => setDriveForm({ ...driveForm, roleTitle: event.target.value })} required /></label><label>Registration opens<input type="date" value={driveForm.registrationStart} onChange={(event) => setDriveForm({ ...driveForm, registrationStart: event.target.value })} required /></label><label>Registration closes<input type="date" value={driveForm.registrationEnd} onChange={(event) => setDriveForm({ ...driveForm, registrationEnd: event.target.value })} required /></label><label>Drive date<input type="date" value={driveForm.driveDate} onChange={(event) => setDriveForm({ ...driveForm, driveDate: event.target.value })} required /></label><label>Venue / meeting link<input maxLength="200" value={driveForm.venue} onChange={(event) => setDriveForm({ ...driveForm, venue: event.target.value })} required /></label><label>Selection stages (comma-separated)<input value={driveForm.selectionProcess} onChange={(event) => setDriveForm({ ...driveForm, selectionProcess: event.target.value })} /></label><label>Minimum CGPA<input type="number" min="0" max="10" step=".1" value={driveForm.minCgpa} onChange={(event) => setDriveForm({ ...driveForm, minCgpa: event.target.value })} required /></label><label>Status<select value={driveForm.status} onChange={(event) => setDriveForm({ ...driveForm, status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option></select></label></div><button className="button button-primary" disabled={busy || !companies.length}>Save drive <Plus size={14} /></button></form><section className="panel">{drivesLoading ? <p>Loading placement drives…</p> : drives.map((drive) => <article className="trainer-material-row" key={drive.id}><span><strong>{drive.roleTitle} · {drive.companyName}</strong><small>{drive.driveDate} · {drive.venue} · registration {drive.registrationStart} – {drive.registrationEnd}</small></span><StatusTag>{drive.status}</StatusTag><select aria-label={`Drive status for ${drive.roleTitle}`} value={drive.status} onChange={(event) => submit(`/placement/drives/${drive.id}`, "PATCH", { status: event.target.value }, "Drive status updated.", reloadDrives)}><option value="draft">Draft</option><option value="published">Published</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></article>)}{!drivesLoading && !drives.length && <p className="trainer-empty-note">No drives are scheduled yet.</p>}</section></>}
    {section === "placementApplications" && <section className="panel">{applicationsLoading ? <p>Loading applications…</p> : applications.map((application) => <article className="coordinator-request-card" key={application.id}><div className="coordinator-request-heading"><span><strong>{application.student?.name || "Student"} · {application.title}</strong><small>{application.student?.studentId} · {application.companyName} · {new Date(application.createdAt).toLocaleDateString()}</small></span><select aria-label={`Application status for ${application.student?.name || "student"}`} value={application.status} onChange={(event) => submit(`/placement/applications/${application.id}`, "PATCH", { status: event.target.value }, "Application decision saved and student notified.", reloadApplications)}>{placementStatusOptions.map((value) => <option key={value} value={value}>{displayStatus(value)}</option>)}</select></div>{application.reason && <p>{application.reason}</p>}</article>)}{!applicationsLoading && !applications.length && <p className="trainer-empty-note">Student applications appear here as candidates apply.</p>}</section>}
    {section === "placementInterviews" && <><form className="panel platform-form" onSubmit={(event) => { event.preventDefault(); submit("/placement/interviews", "POST", interviewForm, "Interview scheduled and candidate notified.", async () => { await Promise.all([reloadInterviews(), reloadApplications()]); setInterviewForm({ applicationId: "", scheduledAt: "", roundType: "Technical", venue: "", meetingLink: "" }); }); }}><div className="panel-heading"><div><span className="eyebrow">CANDIDATE INTERVIEW</span><h3>Schedule a round</h3></div><CalendarDays size={18} /></div><div className="platform-form-grid"><label>Candidate application<select value={interviewForm.applicationId} onChange={(event) => setInterviewForm({ ...interviewForm, applicationId: event.target.value })} required><option value="">Choose application</option>{activeApplications.map((application) => <option key={application.id} value={application.id}>{application.student?.name} · {application.title} · {application.companyName}</option>)}</select></label><label>Date & time<input type="datetime-local" value={interviewForm.scheduledAt} onChange={(event) => setInterviewForm({ ...interviewForm, scheduledAt: event.target.value })} required /></label><label>Round type<input maxLength="60" value={interviewForm.roundType} onChange={(event) => setInterviewForm({ ...interviewForm, roundType: event.target.value })} required /></label><label>Venue<input maxLength="200" value={interviewForm.venue} onChange={(event) => setInterviewForm({ ...interviewForm, venue: event.target.value })} required /></label><label>HTTPS meeting link (optional)<input type="url" value={interviewForm.meetingLink} onChange={(event) => setInterviewForm({ ...interviewForm, meetingLink: event.target.value })} /></label></div><button className="button button-primary" disabled={busy || !activeApplications.length}>Schedule interview <Plus size={14} /></button></form><section className="panel">{interviewsLoading ? <p>Loading interview schedule…</p> : interviews.map((interview) => <article className="trainer-material-row" key={interview.id}><span><strong>{interview.application?.student?.name || "Candidate"} · {interview.roundType}</strong><small>{interview.application?.title} · {new Date(interview.scheduledAt).toLocaleString()} · {interview.venue}</small></span><select value={interview.status} aria-label={`Interview status for ${interview.application?.student?.name || "candidate"}`} onChange={(event) => submit(`/placement/interviews/${interview.id}`, "PATCH", { status: event.target.value }, "Interview record updated.", reloadInterviews)}><option value="scheduled">Scheduled</option><option value="attended">Attended</option><option value="missed">Missed</option><option value="cancelled">Cancelled</option></select></article>)}{!interviewsLoading && !interviews.length && <p className="trainer-empty-note">No interviews have been scheduled.</p>}</section></>}
    {section === "placementOffers" && <><form className="panel platform-form" onSubmit={(event) => { event.preventDefault(); submit("/placement/offers", "POST", offerForm, "Verified offer recorded and student notified.", async () => { await Promise.all([reloadOffers(), reloadApplications()]); setOfferForm({ applicationId: "", packageText: "", joiningDate: "" }); }); }}><div className="panel-heading"><div><span className="eyebrow">OFFICIAL RESULT</span><h3>Record a verified offer</h3></div><Award size={18} /></div><div className="platform-form-grid"><label>Selected candidate<select value={offerForm.applicationId} onChange={(event) => setOfferForm({ ...offerForm, applicationId: event.target.value })} required><option value="">Choose application</option>{activeApplications.map((application) => <option key={application.id} value={application.id}>{application.student?.name} · {application.title} · {application.companyName}</option>)}</select></label><label>Verified package / stipend<input maxLength="80" value={offerForm.packageText} onChange={(event) => setOfferForm({ ...offerForm, packageText: event.target.value })} placeholder="Optional" /></label><label>Joining date<input type="date" value={offerForm.joiningDate} onChange={(event) => setOfferForm({ ...offerForm, joiningDate: event.target.value })} /></label></div><p className="field-hint">Only enter results officially shared by the company.</p><button className="button button-primary" disabled={busy || !activeApplications.length}>Record offer <Check size={14} /></button></form><section className="panel">{offersLoading ? <p>Loading offers…</p> : offers.map((offer) => <article className="trainer-material-row" key={offer.id}><span><strong>{offer.student?.name || "Student"} · {offer.companyName} · {offer.roleTitle}</strong><small>{offer.packageText || "Package not specified"} · joining {offer.joiningDate || "date not set"}</small></span><select aria-label={`Offer status for ${offer.student?.name || "student"}`} value={offer.status} onChange={(event) => submit(`/placement/offers/${offer.id}`, "PATCH", { status: event.target.value }, "Offer status updated and candidate notified.", reloadOffers)}><option value="offered">Offered</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="joined">Joined</option></select></article>)}{!offersLoading && !offers.length && <p className="trainer-empty-note">Official offers recorded by the placement office appear here.</p>}</section></>}
    {section === "placementReports" && <>{reportLoading ? <section className="panel">Loading placement analytics…</section> : report && <><div className="platform-stats-row">{[["Registered students", report.students], ["Eligible", report.eligibleStudents], ["Students placed", report.placedStudents], ["Placement rate", `${report.placementPercent}%`], ["Applications", report.applications], ["Offers accepted", report.acceptedOffers]].map(([label, value]) => <article className="platform-stat" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><section className="panel"><div className="panel-heading"><div><span className="eyebrow">RECRUITER OUTCOMES</span><h3>Company-wise placement history</h3></div></div><div className="table-wrap"><table><thead><tr><th>COMPANY</th><th>APPLICATIONS</th><th>ACCEPTED / JOINED</th></tr></thead><tbody>{report.companies.map((company) => <tr key={company.id}><td>{company.name}</td><td>{company.applications}</td><td>{company.selections}</td></tr>)}</tbody></table></div></section><section className="panel"><div className="panel-heading"><div><span className="eyebrow">DRIVE REGISTRATIONS</span><h3>Participation overview</h3></div></div>{report.drives.map((drive) => <article className="trainer-material-row" key={drive.id}><span><strong>{drive.title} · {drive.company}</strong></span><StatusTag>{drive.registrations} applications</StatusTag></article>)}</section></>}</>}
    {section === "placementResources" && <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">RESUME REVIEW</span><h3>Review student resumes privately</h3></div><FileText size={18} /></div><p className="trainer-empty-note">Open Student Placement Profiles to filter candidates and securely review PDF resumes. Students keep control of their profile uploads.</p><button className="button button-primary" onClick={() => setPage("placementStudents")}>Open student profiles <ArrowRight size={14} /></button></section><section className="panel"><div className="panel-heading"><div><span className="eyebrow">CAREER PREPARATION</span><h3>Share trusted preparation</h3></div><Sparkles size={18} /></div><div className="career-resource-grid"><a href="https://developer.mozilla.org/en-US/docs/Learn" target="_blank" rel="noreferrer"><BookOpen size={15} /> Technical learning <ArrowRight size={13} /></a><a href="https://www.linkedin.com/learning/topics/resume-writing" target="_blank" rel="noreferrer"><FileText size={15} /> Resume writing <ArrowRight size={13} /></a><a href="https://www.linkedin.com/learning/topics/interviewing" target="_blank" rel="noreferrer"><MessageCircle size={15} /> Interview practice <ArrowRight size={13} /></a></div><p className="field-hint">Use Announcements to share campus-approved clinics, mock interviews, and deadlines with students.</p><button className="button button-outline button-small" onClick={() => setPage("announcements")}>Write a career announcement <Send size={13} /></button></section></div>}
  </div>;
}

function StudentPlacementOpportunities({ courses }) {
  const { data, loading, error, reload } = useLoad("/placement/opportunities", { jobs: [], drives: [], applications: [] });
  const { data: profile, setData, error: profileError } = useLoad("/placement/profile", { skills: [], cgpa: "", graduationYear: "", courseId: "" });
  const [form, setForm] = useState({ skills: "", cgpa: "", graduationYear: "", courseId: "" });
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  useEffect(() => setForm({ skills: (profile.skills || []).join(", "), cgpa: profile.cgpa ?? "", graduationYear: profile.graduationYear ?? "", courseId: profile.courseId || "" }), [profile]);
  async function saveProfile(event) {
    event.preventDefault(); setFormError(""); setNotice("");
    try {
      const saved = await api("/placement/profile", { method: "PATCH", body: JSON.stringify({ skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean), cgpa: Number(form.cgpa), graduationYear: Number(form.graduationYear), courseId: form.courseId }) });
      setData(saved); setNotice("Placement profile saved. Your eligible opportunities are updated."); await reload();
    } catch (err) { setFormError(err.message); }
  }
  async function apply(item, kind) {
    setFormError(""); setNotice("");
    try { await api("/placement/applications", { method: "POST", body: JSON.stringify({ [kind === "job" ? "jobId" : "driveId"]: item.id }) }); setNotice(`Application sent for ${item.title || item.roleTitle}.`); await reload(); }
    catch (err) { setFormError(err.message); }
  }
  const applicationFor = (item, kind) => data.applications.find((application) => application[kind === "job" ? "jobId" : "driveId"] === item.id);
  return <section className="panel student-placement-panel"><div className="panel-heading"><div><span className="eyebrow">PLACEMENT OPPORTUNITIES</span><h3>Prepare your profile & apply</h3></div><BriefcaseBusiness size={18} /></div><FormNotice error={error || profileError || formError} notice={notice} />
    <form className="platform-form student-placement-profile" onSubmit={saveProfile}><div className="platform-form-grid"><label>Technical skills (comma-separated)<input value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} placeholder="Java, React, SQL" required /></label><label>CGPA (out of 10)<input type="number" min="0" max="10" step=".1" value={form.cgpa} onChange={(event) => setForm({ ...form, cgpa: event.target.value })} required /></label><label>Graduation year<input type="number" min="2000" max={new Date().getFullYear() + 8} value={form.graduationYear} onChange={(event) => setForm({ ...form, graduationYear: event.target.value })} required /></label><label>Course<select value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })}><option value="">Select course (optional)</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></label></div><p className="field-hint">Placement eligibility starts at 6.0 CGPA; individual opportunities may require more. Upload your PDF resume from My Profile.</p><button className="button button-outline button-small">Save placement profile <Check size={13} /></button></form>
    {loading ? <p>Finding matching opportunities…</p> : <div className="placement-opportunity-grid">{[...data.jobs.map((item) => ({ ...item, opportunityKind: "job" })), ...data.drives.map((item) => ({ ...item, title: item.roleTitle, description: `${item.companyName} · Drive ${item.driveDate} · ${item.venue}`, opportunityKind: "drive" }))].map((item) => { const application = applicationFor(item, item.opportunityKind); const eligible = Number(profile.cgpa) >= Math.max(6, item.minCgpa); return <article className="placement-opportunity-card" key={item.id}><div className="career-job-top"><span className="course-category">{item.companyName} · {item.opportunityKind === "job" ? item.type : "Placement drive"}</span><StatusTag tone={eligible ? "green" : "orange"}>{eligible ? "Eligible" : `CGPA ${Math.max(6, item.minCgpa)}+`}</StatusTag></div><h4>{item.title}</h4><p>{item.description}</p>{item.skills?.length > 0 && <div className="career-skills">{item.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>}<small>{item.opportunityKind === "job" ? `${item.location} · ${item.workMode} · closes ${item.deadline}${item.packageText ? ` · ${item.packageText}` : ""}` : `Registration closes ${item.registrationEnd}`}</small>{application ? <StatusTag>{displayStatus(application.status)}</StatusTag> : <button className="button button-primary button-small" disabled={!eligible} onClick={() => apply(item, item.opportunityKind)}>{item.opportunityKind === "job" ? "Apply now" : "Register for drive"} <ArrowRight size={13} /></button>}</article>; })}{!data.jobs.length && !data.drives.length && <p className="trainer-empty-note">There are no published matching opportunities right now.</p>}</div>}
  </section>;
}

export function LearningHub({ courses, user, refresh }) {
  const [tab, setTab] = useState("catalog");
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const { data, loading, error: contentError, reload } = useLoad("/learning-content", { lessons: [], resources: [], quizzes: [], modules: [] });
  const { data: certificates, reload: reloadCertificates } = useLoad("/certificates", []);

  function openCourse(course) {
    setSelectedCourseId(course.id);
    setTab("lessons");
    setError("");
    setMessage("");
  }

  async function enroll(course) {
    setError("");
    try {
      await api(`/courses/${course.id}/enroll`, { method: "POST", body: "{}" });
      openCourse(course);
      setMessage(`You are enrolled in ${course.title}.`);
      await refresh();
    } catch (err) { setError(err.message); }
  }
  async function completeLesson(lesson) {
    setBusy(lesson.id); setError("");
    try {
      await api(`/lessons/${lesson.id}/complete`, { method: "POST", body: "{}" });
      await Promise.all([reload(), reloadCertificates(), refresh()]);
      setMessage("Lesson complete — 10 learning points earned.");
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }
  async function completeTopic(topic) {
    setBusy(topic.id); setError("");
    try {
      const progress = await api(`/course-topics/${topic.id}/complete`, { method: "POST", body: "{}" });
      await reload();
      setMessage(progress.assignmentUnlocked
        ? "All module topics complete — the assignment is unlocked."
        : `Topic complete — ${progress.completedCount} of ${progress.totalTopics} topics finished.`);
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }
  async function submitQuiz(event) {
    event.preventDefault();
    try {
      setBusy(quiz.id); setError("");
      const attempt = await api(quiz.moduleId ? `/course-modules/${quiz.moduleId}/attempts` : `/quizzes/${quiz.id}/attempts`, {
        method: "POST",
        body: JSON.stringify({ answers: quiz.questions.map((_item, index) => Number(answers[index])) })
      });
      setResult(attempt); await Promise.all([reload(), reloadCertificates(), refresh()]);
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }
  return <div className="page-content platform-page">
    <Heading eyebrow="LEARN BY BUILDING" title={<>Your learning, <em>all together.</em></>} subtitle="Courses, bite-size lessons, downloadable notes, quizzes, and completion certificates." />
    <div className="platform-tabs" role="tablist">{[["catalog", "Course catalog"], ["lessons", "Course modules & assignments"], ["quizzes", "Quizzes"], ["certificates", "Certificates"]].map(([id, label]) => <button role="tab" aria-selected={tab === id} className={`platform-tab ${tab === id ? "active" : ""}`} key={id} onClick={() => setTab(id)}>{label}</button>)}</div>
    <FormNotice error={error || contentError} notice={message} />
    {tab === "catalog" && <div className="platform-course-grid">{courses.map((course) => <article className="platform-card" key={course.id}>
      <span className={`platform-course-icon illus-${course.color || "purple"}`}>{course.icon || "✳"}</span><span className="course-category">{course.category}</span>
      <h3>{course.title}</h3><p>{course.description}</p><div className="platform-card-meta"><span><BookOpen size={14} /> {data.modules.filter((module) => module.courseId === course.id).length || 4} modules</span><span><Clock3 size={14} /> {course.schedule.split(",")[0]}</span></div>
      <div className="platform-progress"><div><span>YOUR PROGRESS</span><strong>{course.progress || 0}%</strong></div><div className="progress-track"><span style={{ width: `${course.progress || 0}%` }} /></div></div>
      {user.role === "student" && <button className={`button ${course.enrolled ? "button-outline" : "button-primary"} platform-full-button`} onClick={() => course.enrolled ? openCourse(course) : enroll(course)}>{course.enrolled ? "Open course" : "Enroll in course"} <ArrowRight size={14} /></button>}
    </article>)}</div>}
    {tab === "lessons" && <>{selectedCourseId && <button className="button button-outline platform-course-back" onClick={() => { setSelectedCourseId(null); setTab("catalog"); }}><ArrowRight size={14} className="platform-course-back-icon" /> All courses</button>}
      {loading ? <section className="panel">Loading course modules…</section> : <div className={`platform-learning-grid ${selectedCourseId ? "platform-learning-grid-full" : ""}`}>{courses.filter((course) => !selectedCourseId || course.id === selectedCourseId).map((course) => {
      const modules = data.modules.filter((module) => module.courseId === course.id);
      return <section className="panel platform-learning-card" key={course.id}>
        <div className="course-introduction"><span className="eyebrow">COURSE INTRODUCTION</span><h3>{course.title}</h3><p>{data.courseIntroductions?.[course.id]?.introduction || course.description}</p><a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${course.title} course introduction`)}`} target="_blank" rel="noreferrer">Watch course introduction videos <ArrowRight size={13} /></a></div>
        <div className="panel-heading"><div><span className="eyebrow">{course.category}</span><h3>Course roadmap</h3><p>{modules.length * 2} weeks · Study each topic and watch its video before taking the assignment. Pass with 70% to unlock the next module.</p></div></div>
        {modules.map((module) => <article className={`course-module ${module.unlocked ? "" : "locked"}`} key={module.id}>
          <div className="course-module-heading"><div><span className="eyebrow">MODULE {module.order} · WEEKS {module.weeks}</span><h4>{module.title}</h4></div><span className={`pill ${module.passed ? "pill-green" : module.unlocked ? "pill-blue" : ""}`}>{module.passed ? "Passed" : module.unlocked ? "In progress" : "Locked"}</span></div>
          {module.topics.map((topic, index) => <details className="course-topic" key={topic.id} open={index === 0 && module.unlocked && !topic.completed}>
            <summary><span className={`lesson-status ${topic.completed ? "done" : ""}`}>{topic.completed ? <Check size={14} /> : <BookOpen size={14} />}</span><span><strong>Topic {index + 1}: {topic.title}</strong><small>{topic.completed ? "Completed" : "Read the explanation and watch the lesson video"}</small></span></summary>
            <p>{topic.explanation}</p>
            <a className="topic-video-link" href={topic.videoUrl} target="_blank" rel="noreferrer"><BookOpen size={14} /> Watch related topic videos <ArrowRight size={13} /></a>
            {user.role === "student" && module.unlocked && <button className="button button-outline button-small" disabled={topic.completed || busy === topic.id} onClick={() => completeTopic(topic)}>{topic.completed ? "Topic complete" : "Mark topic complete"} <Check size={13} /></button>}
          </details>)}
          {data.lessons.filter((lesson) => lesson.moduleId === module.id).map((lesson) => <article className="lesson-row" key={lesson.id}>
            <span className={`lesson-status ${lesson.completed ? "done" : ""}`}>{lesson.completed ? <Check size={14} /> : <BookOpen size={14} />}</span>
            <div className="lesson-copy"><strong>{lesson.title}</strong><p>{lesson.description}</p><small>{lesson.minutes} min · <a href={lesson.videoUrl} target="_blank" rel="noreferrer">Video / reading <ArrowRight size={12} /></a></small></div>
            {user.role === "student" && module.unlocked && <button className="button button-outline button-small" disabled={lesson.completed || busy === lesson.id} onClick={() => completeLesson(lesson)}>{lesson.completed ? "Complete" : "Mark done"}</button>}
          </article>)}
          {module.latestAttempt && <p className={`module-attempt ${module.latestAttempt.passed ? "passed" : "failed"}`}>Latest assignment score: {module.latestAttempt.score}/{module.latestAttempt.total} ({module.latestAttempt.percentage}%) · {module.latestAttempt.passed ? "Passed" : "70% required"}</p>}
          <div className="module-assignment">
            <div><span className="eyebrow">MODULE ASSIGNMENT</span><strong>{module.assignment.title}</strong><small>{module.assignment.questions.length} questions · MCQs and code reading · 70% to pass</small></div>
            {user.role === "student" && <button className="button button-primary" disabled={!module.unlocked || module.passed || module.topics.some((topic) => !topic.completed) || busy === module.id} onClick={() => { setQuiz({ ...module.assignment, id: module.id, moduleId: module.id }); setAnswers({}); setResult(null); }}>
              {module.passed ? "Assignment passed" : !module.unlocked ? "Pass previous assignment to unlock" : module.topics.some((topic) => !topic.completed) ? "Complete all topics to unlock assignment" : module.latestAttempt ? "Retry assignment" : "Start assignment"} <ArrowRight size={14} />
            </button>}
          </div>
        </article>)}
        {data.resources.filter((resource) => resource.courseId === course.id).map((resource) => <a className="resource-download" key={resource.id} href={resource.url || `/api/resources/${resource.id}/download`} target={resource.url ? "_blank" : undefined} rel={resource.url ? "noreferrer" : undefined}><FileText size={16} /><span><strong>{resource.title}</strong><small>{resource.url ? "Open learning resource" : resource.contentType === "application/pdf" ? "Download course PDF" : "Download course notes"}</small></span>{resource.url ? <ArrowRight size={15} /> : <Download size={15} />}</a>)}
      </section>;
    })}</div>}</>}
    {tab === "quizzes" && <div className="platform-quiz-grid">{data.quizzes.map((item) => <article className="panel platform-quiz-card" key={item.id}>
      <span className="eyebrow">{courses.find((course) => course.id === item.courseId)?.title || "Course quiz"}</span><h3>{item.title}</h3><p>{item.questions.length} questions · 5 points per correct answer.</p>
      {item.latestAttempt && <div className="quiz-last-score">Latest score <strong>{item.latestAttempt.score}/{item.latestAttempt.total} ({item.latestAttempt.percentage}%)</strong></div>}
      <button className="button button-primary" onClick={() => { setQuiz(item); setAnswers({}); setResult(null); }}>Start quiz <ArrowRight size={14} /></button>
    </article>)}</div>}
    {tab === "certificates" && <section className="panel certificate-page"><div className="panel-heading"><div><span className="eyebrow">YOUR ACHIEVEMENTS</span><h3>Course certificates</h3><p>Complete every course lesson and pass all module assignments to receive your personalized certificate.</p></div><Award size={20} /></div>
      <div className="certificate-grid">{certificates.map((item) => item.eligible
        ? <article className="certificate-preview" key={item.courseId}>
          <div className="certificate-preview-brand"><img src="/zyngram-logo.jpe" alt="" /><span>ZYNGRAM<small>CAMPUS HUB</small></span></div>
          <span className="eyebrow">CERTIFICATE OF COURSE COMPLETION</span>
          <p>This certificate is proudly presented to</p>
          <h3>{item.learner}</h3>
          <span className="certificate-preview-divider" aria-hidden="true" />
          <p>for successfully completing the course</p>
          <strong className="certificate-course-title">{item.course}</strong>
          <div className="certificate-preview-footer"><span>Awarded on {new Date(item.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span><span>Certificate ID: ZYN-{item.certificateId}</span></div>
          <div className="certificate-preview-signature">
            <div className="certificate-preview-seal" aria-label="Zyngram course completion verified">
              <span>ZYNGRAM CAMPUS HUB</span><Award size={17} /><small>COMPLETION VERIFIED</small>
            </div>
            <span className="certificate-preview-signatory"><strong>Kasarla Jagan Kumar</strong><small>CEO & Founder</small></span>
          </div>
          <a className="button button-primary certificate-download" href={`/api/certificates/${item.courseId}/pdf`}><Download size={14} /> Download certificate PDF</a>
        </article>
        : <article className="certificate-progress-card" key={item.courseId}>
          <div className="certificate-progress-icon"><Award size={22} /></div>
          <div className="certificate-progress-copy"><span className="eyebrow">CERTIFICATE IN PROGRESS</span><h4>{item.course}</h4><p>{item.learner}</p>
            <div className="certificate-progress-counts"><span>Lessons <strong>{item.completedLessons}/{item.totalLessons}</strong></span><span>Module assignments <strong>{item.passedModules}/{item.totalModules}</strong></span></div>
            <div className="progress-track"><span style={{ width: `${Math.round(((item.totalLessons ? item.completedLessons / item.totalLessons : 0) + (item.totalModules ? item.passedModules / item.totalModules : 0)) / 2 * 100)}%` }} /></div>
          </div>
          <button className="button button-outline" onClick={() => { setSelectedCourseId(item.courseId); setTab("lessons"); }}>Continue course <ArrowRight size={14} /></button>
        </article>)}
      {!certificates.length && <div className="empty-state"><Award size={23} /><strong>Enroll in a course to get started.</strong><p>Your personalized course certificate will appear here when you finish all its lessons and pass every module assignment.</p><button className="button button-outline" onClick={() => setTab("catalog")}>Browse courses <ArrowRight size={14} /></button></div>}
      </div>
    </section>}
    {quiz && <div className="platform-modal-scrim"><section className="platform-modal" role="dialog" aria-modal="true">
      <div className="platform-modal-heading"><div><span className="eyebrow">{quiz.moduleId ? "MODULE ASSIGNMENT · 70% TO PASS" : "KNOWLEDGE CHECK"}</span><h2>{quiz.title}</h2>{quiz.moduleId && <p>Choose the best answer for every question. Code snippets ask you to trace behavior, find bugs or evaluate a solution.</p>}</div><button className="button button-outline" onClick={() => setQuiz(null)}>Close</button></div>
      {result ? <div className="quiz-result"><Award size={28} /><h3>{result.score} / {result.total} correct</h3><p>{quiz.moduleId ? `You scored ${result.percentage}%. ${result.passed ? "Assignment passed — the next module is now unlocked." : "You need 70% to pass. Review the module and try again."}` : `You scored ${result.percentage}%. ${result.score * 5} learning points added.`}</p>{quiz.moduleId && !result.passed ? <button className="button button-primary" onClick={() => { setAnswers({}); setResult(null); }}>Try again</button> : <button className="button button-primary" onClick={() => setQuiz(null)}>Keep learning</button>}</div> : <form className="modal-form" onSubmit={submitQuiz}>
        {quiz.questions.map((question, index) => <fieldset className="quiz-question" key={index}><legend><span>QUESTION {index + 1} OF {quiz.questions.length}</span>{question.prompt}</legend>{question.code && <pre className="quiz-code"><code>{question.code}</code><small>{question.language}</small></pre>}{question.options.map((option, optionIndex) => <label key={option}><input type="radio" name={`q${index}`} value={optionIndex} checked={Number(answers[index]) === optionIndex} onChange={() => setAnswers({ ...answers, [index]: optionIndex })} required />{option}</label>)}</fieldset>)}
        <FormNotice error={error} /><button className="button button-primary" disabled={busy === quiz.id}>{busy ? "Checking…" : "Submit answers"} <Check size={14} /></button>
      </form>}
    </section></div>}
  </div>;
}

export function TrainerCoursesPage({ user, courses, refresh }) {
  const { data: content, loading, error: contentError, reload: reloadContent } = useLoad("/learning-content", { resources: [] });
  const [courseForm, setCourseForm] = useState({ title: "", category: "", description: "", schedule: "" });
  const [resourceForm, setResourceForm] = useState({ courseId: courses[0]?.id || "", title: "", type: "notes", content: "", url: "" });
  const [file, setFile] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    if (!resourceForm.courseId && courses[0]) setResourceForm((current) => ({ ...current, courseId: courses[0].id }));
  }, [courses, resourceForm.courseId]);
  async function createCourse(event) {
    event.preventDefault(); setBusy("course"); setError(""); setNotice("");
    try {
      await api("/courses", { method: "POST", body: JSON.stringify(courseForm) });
      setCourseForm({ title: "", category: "", description: "", schedule: "" });
      setNotice("Course created and added to the campus catalog.");
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }
  async function shareResource(event) {
    event.preventDefault(); setBusy("resource"); setError(""); setNotice("");
    try {
      let uploadedFile;
      if (resourceForm.type === "pdf") {
        if (!file) throw new Error("Choose a PDF file to upload.");
        if (file.size > 2 * 1024 * 1024) throw new Error("Choose a PDF smaller than 2 MB.");
        uploadedFile = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
          reader.onerror = () => reject(new Error("Could not read that PDF file."));
          reader.readAsDataURL(file);
        });
      }
      await api("/resources", {
        method: "POST",
        body: JSON.stringify({
          ...resourceForm,
          ...(uploadedFile ? { file: uploadedFile } : {})
        })
      });
      setResourceForm((current) => ({ ...current, title: "", content: "", url: "" }));
      setFile(null);
      setNotice("Learning material shared with the course.");
      await reloadContent();
    } catch (err) { setError(err.message); }
    finally { setBusy(""); }
  }
  const resources = content.resources.filter((item) => courses.some((course) => course.id === item.courseId));
  return <div className="page-content platform-page trainer-courses-page">
    <Heading eyebrow="TRAINER COURSE STUDIO" title={<>Build a course. <em>Grow a cohort.</em></>} subtitle="Create courses, share study resources, and track the learners enrolled in your classes." />
    <FormNotice error={error || contentError} notice={notice} />
    <form className="panel platform-form" onSubmit={createCourse}>
      <div className="panel-heading"><div><span className="eyebrow">ADD TO COURSE CATALOG</span><h3>Create a course</h3></div><BookOpen size={19} /></div>
      <div className="platform-form-grid">
        <label>Course title<input maxLength="120" value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} required /></label>
        <label>Category<input maxLength="60" value={courseForm.category} onChange={(event) => setCourseForm({ ...courseForm, category: event.target.value })} placeholder="e.g. WEB DEVELOPMENT" required /></label>
        <label className="platform-form-wide">Description<textarea maxLength="1000" rows="3" value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} required /></label>
        <label>Class schedule<input maxLength="120" value={courseForm.schedule} onChange={(event) => setCourseForm({ ...courseForm, schedule: event.target.value })} placeholder="e.g. Monday · Wednesday, 10:00 AM" /></label>
      </div>
      <button className="button button-primary" disabled={busy === "course"}>{busy === "course" ? "Creating…" : "Create course"} <Plus size={14} /></button>
    </form>
    <div className="trainer-course-grid">{courses.map((course) => <article className="panel trainer-course-card" key={course.id}>
      <span className="course-category">{course.category}</span><h3>{course.title}</h3><p>{course.description}</p>
      <div className="trainer-course-card-meta"><span><Users size={14} /> {course.enrolled?.length || 0} enrolled</span><span><CalendarDays size={14} /> {course.schedule}</span></div>
      <small>Trainer ID: {user.trainerId} · Course ID: {course.id}</small>
    </article>)}
      {!courses.length && <section className="panel empty-state"><BookOpen size={22} /><strong>No courses assigned yet.</strong><p>Create your first course above. Students can enroll from the course catalog.</p></section>}
    </div>
    <form className="panel platform-form" onSubmit={shareResource}>
      <div className="panel-heading"><div><span className="eyebrow">COURSE LIBRARY</span><h3>Share learning materials</h3></div><FileText size={19} /></div>
      <div className="platform-form-grid">
        <label>Course<select value={resourceForm.courseId} onChange={(event) => setResourceForm({ ...resourceForm, courseId: event.target.value })} required><option value="" disabled>Select a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        <label>Resource title<input maxLength="120" value={resourceForm.title} onChange={(event) => setResourceForm({ ...resourceForm, title: event.target.value })} required /></label>
        <label>Resource type<select value={resourceForm.type} onChange={(event) => { setResourceForm({ ...resourceForm, type: event.target.value }); setFile(null); }}><option value="notes">Study notes</option><option value="pdf">PDF</option><option value="link">HTTPS link</option></select></label>
        {resourceForm.type === "notes" && <label className="platform-form-wide">Notes<textarea maxLength="10000" rows="4" value={resourceForm.content} onChange={(event) => setResourceForm({ ...resourceForm, content: event.target.value })} required /></label>}
        {resourceForm.type === "link" && <label className="platform-form-wide">Learning resource URL<input type="url" value={resourceForm.url} onChange={(event) => setResourceForm({ ...resourceForm, url: event.target.value })} placeholder="https://…" required /></label>}
        {resourceForm.type === "pdf" && <label className="platform-form-wide">PDF file<input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} required /></label>}
      </div>
      <button className="button button-primary" disabled={busy === "resource" || !courses.length}>{busy === "resource" ? "Sharing…" : "Share material"} <Plus size={14} /></button>
    </form>
    <section className="panel trainer-material-list"><div className="panel-heading"><div><span className="eyebrow">AVAILABLE TO YOUR LEARNERS</span><h3>Shared materials</h3></div><FileText size={19} /></div>
      {loading ? <p>Loading learning materials…</p> : resources.map((resource) => <article className="trainer-material-row" key={resource.id}><span><strong>{resource.title}</strong><small>{courses.find((course) => course.id === resource.courseId)?.title}</small></span><a className="button button-outline button-small" href={resource.url || `/api/resources/${resource.id}/download`} target={resource.url ? "_blank" : undefined} rel={resource.url ? "noreferrer" : undefined}>{resource.url ? "Open link" : "Download"} <ArrowRight size={13} /></a></article>)}
      {!loading && !resources.length && <p className="trainer-empty-note">No study materials shared yet.</p>}
    </section>
  </div>;
}

export function AdminUsersPage({ defaultRole = "all" }) {
const { data, loading, error, reload } = useLoad("/admin/users", []);
const [notice, setNotice] = useState("");
const [search, setSearch] = useState("");
const [roleFilter, setRoleFilter] = useState(defaultRole);
const [form, setForm] = useState({ name: "", email: "", role: "trainer", password: "" });
const [passwords, setPasswords] = useState({});
const [editing, setEditing] = useState(null);
const [busy, setBusy] = useState(false);
async function createUser(event) {
  event.preventDefault(); setBusy(true); setNotice("");
  try {
    const created = await api("/admin/users", { method: "POST", body: JSON.stringify(form) });
    setNotice(created.user.role === "student"
      ? `Student account created. ZIN ID: ${created.user.zinId} · ${created.user.email}`
      : `${created.user.name}'s account was created. They must change the initial password on first sign-in.`);
    setForm({ name: "", email: "", role: "trainer", password: "" });
    await reload();
  } catch (err) { setNotice(err.message); }
  finally { setBusy(false); }
}
async function changeRole(user, role) {
  setNotice("");
  try {
    await api(`/admin/users/${user.id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
    setNotice(`${user.name}'s role has been updated.`); await reload();
  } catch (err) { setNotice(err.message); }
}
async function saveEdit(event) {
  event.preventDefault(); setBusy(true); setNotice("");
  try { await api(`/admin/users/${editing.id}`, { method: "PATCH", body: JSON.stringify(editing) }); setNotice(`${editing.name}'s profile was updated.`); setEditing(null); await reload(); }
  catch (err) { setNotice(err.message); }
  finally { setBusy(false); }
}
async function toggleStatus(user) {
  setNotice("");
  try { await api(`/admin/users/${user.id}/status`, { method: "PATCH", body: JSON.stringify({ active: !user.active }) }); setNotice(`${user.name}'s access was ${user.active ? "disabled" : "enabled"}.`); await reload(); }
  catch (err) { setNotice(err.message); }
}
async function resetPassword(user) {
  if (!passwords[user.id]) { setNotice("Enter a new secure password before resetting."); return; }
  setBusy(true); setNotice("");
  try {
    await api(`/admin/users/${user.id}/reset-password`, { method: "POST", body: JSON.stringify({ password: passwords[user.id] }) });
    setPasswords({ ...passwords, [user.id]: "" }); setNotice(`Password reset for ${user.name}. Their active sessions were revoked.`);
    await reload();
  } catch (err) { setNotice(err.message); }
  finally { setBusy(false); }
}
const visibleUsers = data.filter((user) => (roleFilter === "all" || user.role === roleFilter)
  && `${user.name} ${user.email} ${user.zinId || ""}`.toLowerCase().includes(search.toLowerCase()));
return <div className="page-content platform-page"><Heading eyebrow={defaultRole === "all" ? "USERS & ACCESS MANAGEMENT" : `${defaultRole.toUpperCase()} MANAGEMENT`} title={<>The right people, <em>the right access.</em></>} subtitle="Create accounts, review profiles, assign roles, control sign-in access, and reset passwords securely." />
  {error && <FormNotice error={error} />}{notice && <p className="form-success" role="status">{notice}</p>}
  <form className="panel platform-form admin-create-user-form" onSubmit={createUser}><div className="panel-heading"><div><span className="eyebrow">CREATE CAMPUS ACCOUNT</span><h3>Welcome someone new</h3></div><Users size={19} /></div><div className="platform-form-grid">
    <label>Full name<input maxLength="80" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
    <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, email: "" })}>{[["student", "Student"], ["trainer", "Trainer"], ["coordinator", "Coordinator"], ["administrator", "Administrator"], ["placement_officer", "Placement officer"]].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    {form.role !== "student" && <label>Work email<input type="email" maxLength="254" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@zyngram.com" pattern="^[^\\s@]+@zyngram\\.com$" required /></label>}
    <label>Initial password<input type="password" minLength="8" maxLength="128" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /><small className="field-hint">8–128 characters, including a letter and number. Staff change it on first sign-in.</small></label>
  </div><button className="button button-primary" disabled={busy}>{busy ? "Creating…" : "Create account"} <Plus size={14} /></button></form>
  <section className="panel admin-users-panel"><div className="panel-heading"><div><span className="eyebrow">ADMINISTRATOR WORKSPACE</span><h3>Campus accounts · {visibleUsers.length}</h3></div><Users size={19} /></div>
    <div className="admin-user-filters"><input aria-label="Search accounts" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or ZIN ID" /><select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">All roles</option>{["student", "trainer", "coordinator", "administrator", "placement_officer"].map((role) => <option value={role} key={role}>{role.replace("_", " ")}</option>)}</select></div>
    {loading && <p>Loading campus accounts…</p>}
    {visibleUsers.map((user) => <div className="admin-user-management-row" key={user.id}><div className="admin-user-row"><span className="discussion-avatar">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{user.name}</strong><small>{user.zinId ? `${user.zinId} · ` : ""}{user.email}</small></div><StatusTag tone={user.active ? "green" : "orange"}>{user.active ? "Active" : "Inactive"}</StatusTag>
      <select aria-label={`Role for ${user.name}`} value={user.role} disabled={user.id === "u-admin"} onChange={(event) => changeRole(user, event.target.value)}>{[["student", "Student"], ["trainer", "Trainer"], ["coordinator", "Coordinator"], ["placement_officer", "Placement officer"], ["administrator", "Administrator"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <button className="button button-outline button-small" onClick={() => setEditing({ id: user.id, name: user.name, title: user.title || "", phone: user.phone || "", skills: "", bio: "" })}>Edit</button><button className="button button-outline button-small" disabled={user.id === "u-admin"} onClick={() => toggleStatus(user)}>{user.active ? "Deactivate" : "Activate"}</button></div>
      <div className="admin-reset-row"><input aria-label={`New password for ${user.name}`} type="password" minLength="8" maxLength="128" value={passwords[user.id] || ""} onChange={(event) => setPasswords({ ...passwords, [user.id]: event.target.value })} placeholder="Set new password (8+ chars, letters + numbers)" /><button className="button button-outline button-small" disabled={busy} onClick={() => resetPassword(user)}>Reset password</button>{user.mustChangePassword && <small>Must update password on sign-in</small>}</div>
      {editing?.id === user.id && <form className="admin-edit-form" onSubmit={saveEdit}><label>Name<input maxLength="80" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required /></label><label>Title<input maxLength="120" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label><label>Phone<input maxLength="32" value={editing.phone} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} /></label><label>Skills<input maxLength="300" value={editing.skills} onChange={(event) => setEditing({ ...editing, skills: event.target.value })} /></label><button className="button button-primary button-small" disabled={busy}>Save profile</button><button type="button" className="button button-outline button-small" onClick={() => setEditing(null)}>Cancel</button></form>}
    </div>)}
  </section>
</div>;
}

export function AdminCoursesPage() {
  const { data: courses, loading, error, reload } = useLoad("/courses", []);
  const { data: trainers } = useLoad("/trainers", []);
  const [form, setForm] = useState({ title: "", category: "", description: "", schedule: "", trainerId: "", status: "active" });
  const [editingId, setEditingId] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      await api(editingId ? `/admin/courses/${editingId}` : "/admin/courses", {
        method: editingId ? "PATCH" : "POST", body: JSON.stringify(form)
      });
      setNotice(editingId ? "Course settings saved." : "Course created and published.");
      setEditingId(""); setForm({ title: "", category: "", description: "", schedule: "", trainerId: "", status: "active" });
      await reload();
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }
  function edit(course) {
    setEditingId(course.id);
    setForm({
      title: course.title, category: course.category, description: course.description,
      schedule: course.schedule, trainerId: course.trainerId || "", status: course.status || "active"
    });
  }
  return <div className="page-content platform-page"><Heading eyebrow="COURSE CATALOG ADMINISTRATION" title={<>Shape the learning <em>catalog.</em></>} subtitle="Create and maintain courses, assign trainers, and publish or archive catalog entries. Course materials remain available through the trainer workspace." />
    {notice && <FormNotice notice={notice} />}
    <form className="panel platform-form" onSubmit={save}><div className="panel-heading"><div><span className="eyebrow">ADMINISTRATOR COURSE STUDIO</span><h3>{editingId ? "Edit course" : "Create a course"}</h3></div><BookOpen size={19} /></div><div className="platform-form-grid">
      <label>Course title<input maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
      <label>Category<input maxLength="60" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required /></label>
      <label>Trainer<select value={form.trainerId} onChange={(event) => setForm({ ...form, trainerId: event.target.value })}><option value="">Unassigned</option>{trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.name}</option>)}</select></label>
      <label>Schedule<input maxLength="120" value={form.schedule} onChange={(event) => setForm({ ...form, schedule: event.target.value })} placeholder="e.g. Monday · Wednesday, 10:00 AM" /></label>
      {editingId && <label>Catalog status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Published</option><option value="archived">Archived</option></select></label>}
      <label className="platform-form-wide">Description<textarea maxLength="1000" rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></label>
    </div><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : editingId ? "Save course" : "Create course"} <Plus size={14} /></button>{editingId && <button type="button" className="button button-outline button-small" onClick={() => { setEditingId(""); setForm({ title: "", category: "", description: "", schedule: "", trainerId: "", status: "active" }); }}>Cancel</button>}</form>
    {error && <FormNotice error={error} />}
    <section className="coordinator-trainer-grid admin-course-grid">{!loading && courses.map((course) => <article className="panel coordinator-trainer-card" key={course.id}><div className="course-card-top"><span className="course-category">{course.category}</span><StatusTag tone={course.status === "archived" ? "orange" : "green"}>{course.status || "active"}</StatusTag></div><h3>{course.title}</h3><p>{course.description}</p><div className="trainer-course-card-meta"><span><Users size={14} /> {course.enrolled?.length || 0} enrolled</span><span>{course.trainer}</span><span>{course.schedule}</span></div><button className="button button-outline button-small" onClick={() => edit(course)}>Edit course</button></article>)}{loading && <section className="panel">Loading catalog…</section>}</section>
  </div>;
}

export function AdminPermissionsPage() {
  const { data, loading, error } = useLoad("/admin/permissions", []);
  return <div className="page-content platform-page"><Heading eyebrow="ROLE & PERMISSION MANAGEMENT" title={<>Access that's <em>clear by design.</em></>} subtitle="System roles have explicit responsibilities; protected backend routes enforce authorization independently of navigation." />
    {error && <FormNotice error={error} />}{loading ? <section className="panel">Loading role permissions…</section> : <div className="coordinator-trainer-grid">{data.map((item) => <article className="panel coordinator-trainer-card" key={item.role}><span className="eyebrow">SYSTEM ROLE</span><h3>{item.role.replaceAll("_", " ")}</h3><p>{item.description}</p></article>)}</div>}
    <section className="panel permission-security-note"><ShieldCheck size={18} /><span><strong>Backend-enforced access</strong><small>Role changes and user access are administrator-only. Coordinators monitor but cannot grade or record attendance. Trainers can manage only their assigned courses.</small></span></section>
  </div>;
}

export function AdminAuditPage() {
  const [search, setSearch] = useState("");
  const { data, loading, error } = useLoad(`/admin/audit-logs?search=${encodeURIComponent(search)}`, []);
  return <div className="page-content platform-page"><Heading eyebrow="ADMINISTRATIVE ACTIVITY HISTORY" title={<>Every important change, <em>accounted for.</em></>} subtitle="Review administrative account, role, course, announcement, and settings changes. Passwords and tokens are never included." />
    <section className="panel coordinator-search-panel"><label htmlFor="audit-search"><Search size={16} /> Search audit records<input id="audit-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Actor, action, target, or details" /></label><span>{data.length} records · most recent first</span></section>
    {error && <FormNotice error={error} />}{loading ? <section className="panel">Loading audit history…</section> : <section className="panel coordinator-requests-panel">{data.map((item) => <article className="coordinator-request-card" key={item.id}><div className="coordinator-request-heading"><span><strong>{item.action.replaceAll("_", " ")}</strong><small>{item.actorName} · {new Date(item.createdAt).toLocaleString()}</small></span><StatusTag tone="green">{item.outcome}</StatusTag></div><p>{item.detail}</p><small className="coordinator-request-category">{item.targetType} · {item.targetId}</small></article>)}{!data.length && <Empty icon={Clock3} title="No matching activity." text="Administrative changes will appear here after they are made." />}</section>}
  </div>;
}

export function AdminSettingsPage() {
  const { data, loading, error } = useLoad("/admin/settings", { applicationName: "Zyngram Campus Hub", sessionHours: 8, minimumPasswordLength: 8 });
  const [form, setForm] = useState(data);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(data); }, [data]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const updated = await api("/admin/settings", { method: "PATCH", body: JSON.stringify({ ...form, sessionHours: Number(form.sessionHours), minimumPasswordLength: Number(form.minimumPasswordLength) }) });
      setForm(updated); setNotice("System settings saved. New sessions and passwords will use the updated policy.");
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  }
  return <div className="page-content platform-page"><Heading eyebrow="SYSTEM SETTINGS & SECURITY" title={<>A safer campus, <em>thoughtfully configured.</em></>} subtitle="Manage app identity, session duration, and minimum password length. Secrets and database credentials stay in server environment variables." />
    {error && <FormNotice error={error} />}{loading ? <section className="panel">Loading system settings…</section> : <form className="panel platform-form" onSubmit={save}><div className="panel-heading"><div><span className="eyebrow">APPLICATION POLICY</span><h3>System defaults</h3></div><ShieldCheck size={19} /></div><div className="platform-form-grid"><label>Application name<input maxLength="80" value={form.applicationName} onChange={(event) => setForm({ ...form, applicationName: event.target.value })} required /></label><label>Session duration (hours)<input type="number" min="1" max="24" value={form.sessionHours} onChange={(event) => setForm({ ...form, sessionHours: event.target.value })} required /></label><label>Minimum password length<input type="number" min="8" max="16" value={form.minimumPasswordLength} onChange={(event) => setForm({ ...form, minimumPasswordLength: event.target.value })} required /></label></div><FormNotice notice={notice} /><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save security settings"} <Check size={14} /></button><p className="field-hint">Existing sessions keep their current expiry; this duration applies to new sign-ins.</p></form>}
    <section className="panel permission-security-note"><ShieldCheck size={18} /><span><strong>Keep credentials private</strong><small>Database URIs, AI API keys, and signing secrets must be configured only in server-side environment variables and never in frontend code.</small></span></section>
  </div>;
}

const emptyManagedApi = {
  id: "", name: "", description: "", module: "", baseUrl: "/api", endpointPath: "",
  method: "GET", version: "v1", environment: "development", authRequired: true, status: "active"
};
const emptyManagedConsumer = {
  id: "", name: "", description: "", allowedApiIds: [], allowedMethods: ["GET"],
  rateLimit: 60, status: "active"
};

export function AdminApiManagementPage() {
  const { data: apis, loading: apisLoading, error: apisError, reload: reloadApis } = useLoad("/admin/apis", []);
  const { data: consumers, loading: consumersLoading, error: consumersError, reload: reloadConsumers } = useLoad("/admin/consumers", []);
  const { data: usage, loading: usageLoading, error: usageError, reload: reloadUsage } = useLoad("/admin/api-usage", {
    total: 0, summary: { total: 0, successful: 0, failed: 0, successRate: 0 }, entries: []
  });
  const [section, setSection] = useState("apis");
  const [apiSearch, setApiSearch] = useState("");
  const [apiStatus, setApiStatus] = useState("all");
  const [apiMethod, setApiMethod] = useState("all");
  const [apiModule, setApiModule] = useState("all");
  const [apiPage, setApiPage] = useState(1);
  const [apiForm, setApiForm] = useState(emptyManagedApi);
  const [consumerForm, setConsumerForm] = useState(emptyManagedConsumer);
  const [editingApi, setEditingApi] = useState("");
  const [editingConsumer, setEditingConsumer] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [issuedKey, setIssuedKey] = useState(null);
  const apiPageSize = 10;
  const filteredApis = apis.filter((item) => {
    const query = apiSearch.trim().toLowerCase();
    return (!query || [item.id, item.name, item.module, item.endpointPath, item.description]
      .some((value) => String(value || "").toLowerCase().includes(query)))
      && (apiStatus === "all" || item.status === apiStatus)
      && (apiMethod === "all" || item.method === apiMethod)
      && (apiModule === "all" || item.module === apiModule);
  });
  const apiPageCount = Math.max(1, Math.ceil(filteredApis.length / apiPageSize));
  const visibleApis = filteredApis.slice((apiPage - 1) * apiPageSize, apiPage * apiPageSize);
  const usageSummary = usage.summary || { total: usage.total || 0, successful: 0, failed: 0, successRate: 0 };

  async function refresh() {
    await Promise.all([reloadApis(), reloadConsumers(), reloadUsage()]);
  }
  function editApi(item) {
    setApiForm({ ...emptyManagedApi, ...item });
    setEditingApi(item.id);
    setSection("apis");
    setNotice("");
  }
  function editConsumer(item) {
    setConsumerForm({
      ...emptyManagedConsumer,
      ...item,
      allowedApiIds: item.allowedApiIds || [],
      allowedMethods: item.allowedMethods || ["GET"]
    });
    setEditingConsumer(item.id);
    setSection("consumers");
    setNotice("");
  }
  async function saveApi(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await api(editingApi ? `/admin/apis/${editingApi}` : "/admin/apis", {
        method: editingApi ? "PATCH" : "POST",
        body: JSON.stringify(apiForm)
      });
      setApiForm(emptyManagedApi); setEditingApi("");
      setNotice(editingApi ? "API updated." : "API registered.");
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function saveConsumer(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await api(editingConsumer ? `/admin/consumers/${editingConsumer}` : "/admin/consumers", {
        method: editingConsumer ? "PATCH" : "POST",
        body: JSON.stringify({ ...consumerForm, rateLimit: Number(consumerForm.rateLimit) })
      });
      setConsumerForm(emptyManagedConsumer); setEditingConsumer("");
      setNotice(editingConsumer ? "API consumer updated." : "API consumer created. Issue a key to enable access.");
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function removeApi(item) {
    if (!window.confirm(`Delete API "${item.name}"?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`/admin/apis/${item.id}`, { method: "DELETE" });
      setNotice("API deleted."); await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function removeConsumer(item) {
    if (!window.confirm(`Delete consumer "${item.name}" and revoke its keys?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`/admin/consumers/${item.id}`, { method: "DELETE" });
      setNotice("Consumer deleted and active keys revoked."); await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function issueKey(item) {
    setBusy(true); setError(""); setNotice(""); setIssuedKey(null);
    try {
      setIssuedKey(await api(`/admin/consumers/${item.id}/keys`, { method: "POST", body: "{}" }));
      setNotice(`A new key was issued for ${item.name}. Copy it now; it will not be shown again.`);
      await Promise.all([reloadConsumers(), reloadUsage()]);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function revokeKey(consumer, key) {
    if (!window.confirm(`Revoke API key ${key.keyPrefix}…?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`/admin/consumers/${consumer.id}/keys/${key.id}`, { method: "DELETE" });
      setNotice("API key revoked."); await reloadConsumers();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  function toggleValue(values, value) {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  }

  return <div className="page-content platform-page">
    <Heading eyebrow="API LIFECYCLE & ACCESS CONTROL" title={<>APIs, managed <em>with care.</em></>} subtitle="Create and maintain API records, configure consumer access, rotate credentials, and review request activity." />
    <div className="platform-tabs" role="tablist" aria-label="API management sections">
      {[["apis", "API registry"], ["consumers", "Consumers & keys"], ["usage", "Request logs"]].map(([id, label]) =>
        <button key={id} role="tab" aria-selected={section === id} className={`platform-tab ${section === id ? "active" : ""}`} onClick={() => setSection(id)}>{label}</button>)}
      <a className="button button-outline button-small" href="/api/admin/apis/openapi.json" download="zyngram-campus-hub-openapi.json"><Download size={14} /> OpenAPI JSON</a>
    </div>
    <FormNotice error={error || apisError || consumersError || usageError} notice={notice} />
    {issuedKey && <section className="panel permission-security-note"><KeyRound size={18} /><span><strong>Copy this key now — it is only shown once</strong><input aria-label="New API key" readOnly value={issuedKey.key} onFocus={(event) => event.target.select()} /><small>Key prefix: {issuedKey.keyPrefix}…</small></span><button className="button button-outline button-small" onClick={async () => { try { await navigator.clipboard.writeText(issuedKey.key); setNotice("API key copied."); } catch { setError("Clipboard access was denied. Select and copy the key manually."); } }}>Copy key</button></section>}

    {section === "apis" && <>
      <section className="panel coordinator-search-panel api-registry-filters">
        <label htmlFor="api-registry-search"><Search size={16} /> Search registry<input id="api-registry-search" value={apiSearch} onChange={(event) => { setApiSearch(event.target.value); setApiPage(1); }} placeholder="Name, identifier, module, or endpoint" /></label>
        <label>Status<select value={apiStatus} onChange={(event) => { setApiStatus(event.target.value); setApiPage(1); }}><option value="all">All statuses</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
        <label>Method<select value={apiMethod} onChange={(event) => { setApiMethod(event.target.value); setApiPage(1); }}><option value="all">All methods</option>{["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => <option key={method}>{method}</option>)}</select></label>
        <label>Module<select value={apiModule} onChange={(event) => { setApiModule(event.target.value); setApiPage(1); }}><option value="all">All modules</option>{[...new Set(apis.map((item) => item.module))].sort().map((module) => <option key={module}>{module}</option>)}</select></label>
        <span>{filteredApis.length} matching APIs</span>
      </section>
      <form className="panel platform-form" onSubmit={saveApi}>
        <div className="panel-heading"><div><span className="eyebrow">{editingApi ? "UPDATE API RECORD" : "CREATE API RECORD"}</span><h3>{editingApi ? "Edit registered API" : "Register an API"}</h3></div><Code2 size={19} /></div>
        <div className="platform-form-grid">
          <label>Identifier<input maxLength="64" pattern="[a-z][a-z0-9_\\-]{2,63}" value={apiForm.id} disabled={Boolean(editingApi)} onChange={(event) => setApiForm({ ...apiForm, id: event.target.value })} required /></label>
          <label>Display name<input maxLength="100" value={apiForm.name} onChange={(event) => setApiForm({ ...apiForm, name: event.target.value })} required /></label>
          <label>Owning module<input maxLength="100" value={apiForm.module} onChange={(event) => setApiForm({ ...apiForm, module: event.target.value })} required /></label>
          <label>Version<input maxLength="32" value={apiForm.version} onChange={(event) => setApiForm({ ...apiForm, version: event.target.value })} required /></label>
          <label>Base URL<input value={apiForm.baseUrl} onChange={(event) => setApiForm({ ...apiForm, baseUrl: event.target.value })} required /></label>
          <label>Endpoint path<input maxLength="180" value={apiForm.endpointPath} onChange={(event) => setApiForm({ ...apiForm, endpointPath: event.target.value })} placeholder="/example/:id" required /></label>
          <label>HTTP method<select value={apiForm.method} onChange={(event) => setApiForm({ ...apiForm, method: event.target.value })}>{["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => <option key={method}>{method}</option>)}</select></label>
          <label>Environment<select value={apiForm.environment} onChange={(event) => setApiForm({ ...apiForm, environment: event.target.value })}>{["development", "staging", "production"].map((environment) => <option key={environment}>{environment}</option>)}</select></label>
          <label>Status<select value={apiForm.status} onChange={(event) => setApiForm({ ...apiForm, status: event.target.value })}><option value="active">Active</option><option value="archived">Archived</option></select></label>
          <label>Authentication<select value={String(apiForm.authRequired)} onChange={(event) => setApiForm({ ...apiForm, authRequired: event.target.value === "true" })}><option value="true">Required</option><option value="false">Not required</option></select></label>
          <label className="platform-form-wide">Description<textarea maxLength="600" value={apiForm.description} onChange={(event) => setApiForm({ ...apiForm, description: event.target.value })} required /></label>
        </div>
        <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : editingApi ? "Save API changes" : "Create API"} <Check size={14} /></button>
        {editingApi && <button type="button" className="button button-outline button-small" onClick={() => { setApiForm(emptyManagedApi); setEditingApi(""); }}>Cancel editing</button>}
      </form>
      <section className="panel coordinator-requests-panel">
        <div className="panel-heading"><div><span className="eyebrow">REGISTERED ENDPOINTS</span><h3>{filteredApis.length} API records</h3></div><Code2 size={19} /></div>
        {apisLoading ? <p>Loading APIs…</p> : visibleApis.map((item) => <article className="coordinator-request-card" key={item.id}>
          <div className="coordinator-request-heading"><span><strong>{item.method} {item.baseUrl}{item.endpointPath}</strong><small>{item.name} · {item.module} · {item.version} · {item.environment}</small></span><StatusTag tone={item.status === "active" ? "green" : "orange"}>{item.status}</StatusTag></div>
          <p>{item.description}</p><small>{item.authRequired ? "Authentication required" : "Public endpoint"}{item.isMock ? " · Demo endpoint" : ""}</small>
          <div className="trainer-material-row"><button className="button button-outline button-small" onClick={() => editApi(item)}>Edit</button><button className="button button-outline button-small" disabled={busy} onClick={() => removeApi(item)}><Trash2 size={13} /> Delete</button></div>
        </article>)}
        {!apisLoading && !filteredApis.length && <Empty icon={Code2} title={apis.length ? "No APIs match these filters." : "No APIs registered yet."} text={apis.length ? "Change your search or filters to see other registered APIs." : "Create an API record above to begin managing it."} />}
        {!apisLoading && filteredApis.length > apiPageSize && <nav className="api-pagination" aria-label="API registry pages">
          <button className="button button-outline button-small" disabled={apiPage <= 1} onClick={() => setApiPage(apiPage - 1)}>Previous</button>
          <span>Page {Math.min(apiPage, apiPageCount)} of {apiPageCount}</span>
          <button className="button button-outline button-small" disabled={apiPage >= apiPageCount} onClick={() => setApiPage(apiPage + 1)}>Next</button>
        </nav>}
      </section>
    </>}

    {section === "consumers" && <>
      <form className="panel platform-form" onSubmit={saveConsumer}>
        <div className="panel-heading"><div><span className="eyebrow">{editingConsumer ? "UPDATE CONSUMER" : "CREATE CONSUMER"}</span><h3>{editingConsumer ? "Edit API consumer" : "Add an API consumer"}</h3></div><KeyRound size={19} /></div>
        <div className="platform-form-grid">
          <label>Consumer identifier<input maxLength="64" pattern="[a-z][a-z0-9_\\-]{2,63}" value={consumerForm.id} disabled={Boolean(editingConsumer)} onChange={(event) => setConsumerForm({ ...consumerForm, id: event.target.value })} required /></label>
          <label>Name<input maxLength="100" value={consumerForm.name} onChange={(event) => setConsumerForm({ ...consumerForm, name: event.target.value })} required /></label>
          <label>Description<input maxLength="600" value={consumerForm.description} onChange={(event) => setConsumerForm({ ...consumerForm, description: event.target.value })} /></label>
          <label>Requests per minute<input type="number" min="1" max="10000" value={consumerForm.rateLimit} onChange={(event) => setConsumerForm({ ...consumerForm, rateLimit: event.target.value })} required /></label>
          <label>Status<select value={consumerForm.status} onChange={(event) => setConsumerForm({ ...consumerForm, status: event.target.value })}><option value="active">Active</option><option value="suspended">Suspended</option><option value="revoked">Revoked</option></select></label>
          <fieldset className="platform-form-wide"><legend>Allowed API-key demo endpoints</legend>{apis.filter((item) => item.isMock).map((item) => <label key={item.id}><input type="checkbox" checked={consumerForm.allowedApiIds.includes(item.id)} onChange={() => setConsumerForm({ ...consumerForm, allowedApiIds: toggleValue(consumerForm.allowedApiIds, item.id) })} /> {item.name} ({item.method})</label>)}<small>Consumer keys are currently enforced on these protected demo endpoints; other APIs continue to use Campus Hub session authentication.</small></fieldset>
          <fieldset className="platform-form-wide"><legend>Allowed HTTP methods</legend>{["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => <label key={method}><input type="checkbox" checked={consumerForm.allowedMethods.includes(method)} onChange={() => setConsumerForm({ ...consumerForm, allowedMethods: toggleValue(consumerForm.allowedMethods, method) })} /> {method}</label>)}</fieldset>
        </div>
        <button className="button button-primary" disabled={busy || apisLoading}>{busy ? "Saving…" : editingConsumer ? "Save consumer changes" : "Create consumer"} <Check size={14} /></button>
        {editingConsumer && <button type="button" className="button button-outline button-small" onClick={() => { setConsumerForm(emptyManagedConsumer); setEditingConsumer(""); }}>Cancel editing</button>}
      </form>
      <section className="panel coordinator-requests-panel">
        <div className="panel-heading"><div><span className="eyebrow">INTEGRATION ACCESS</span><h3>{consumers.length} API consumers</h3></div><KeyRound size={19} /></div>
        {consumersLoading ? <p>Loading consumers…</p> : consumers.map((consumer) => <article className="coordinator-request-card" key={consumer.id}>
          <div className="coordinator-request-heading"><span><strong>{consumer.name}</strong><small>{consumer.id} · {consumer.rateLimit} requests/minute</small></span><StatusTag tone={consumer.status === "active" ? "green" : "orange"}>{consumer.status}</StatusTag></div>
          <p>{consumer.description || "No description."}</p><small>APIs: {consumer.allowedApiIds.map((id) => apis.find((item) => item.id === id)?.name || id).join(", ")} · Methods: {consumer.allowedMethods.join(", ")}</small>
          <div className="trainer-material-row"><button className="button button-outline button-small" disabled={busy || consumer.status !== "active"} onClick={() => issueKey(consumer)}><KeyRound size={13} /> Rotate / issue key</button><button className="button button-outline button-small" onClick={() => editConsumer(consumer)}>Edit</button><button className="button button-outline button-small" disabled={busy} onClick={() => removeConsumer(consumer)}><Trash2 size={13} /> Delete</button></div>
          {(consumer.keys || []).map((key) => <div className="trainer-material-row" key={key.id}><span><small>{key.keyPrefix}… · {key.revokedAt ? `revoked ${new Date(key.revokedAt).toLocaleString()}` : "active"}</small></span>{!key.revokedAt && <button className="button button-outline button-small" disabled={busy} onClick={() => revokeKey(consumer, key)}><Trash2 size={13} /> Revoke</button>}</div>)}
        </article>)}
        {!consumersLoading && !consumers.length && <Empty icon={KeyRound} title="No consumers yet." text="Create a consumer and issue it a key to grant integration access." />}
      </section>
    </>}

    {section === "usage" && <>
      <div className="platform-stats-row api-usage-stats">
        <article className="platform-stat"><span>Total API requests</span><strong>{usageSummary.total}</strong><small>Recorded consumer endpoint activity</small></article>
        <article className="platform-stat"><span>Successful requests</span><strong>{usageSummary.successful}</strong><small>Responses below HTTP 400</small></article>
        <article className="platform-stat"><span>Failed requests</span><strong>{usageSummary.failed}</strong><small>Authentication, permission, and service errors</small></article>
        <article className="platform-stat"><span>Success rate</span><strong>{usageSummary.successRate}%</strong><small>Based on recorded request outcomes</small></article>
      </div>
      <section className="panel coordinator-requests-panel">
      <div className="panel-heading"><div><span className="eyebrow">API REQUEST ACTIVITY</span><h3>{usage.total} recent requests</h3></div><button className="button button-outline button-small" onClick={reloadUsage}>Refresh</button></div>
      {usageLoading ? <p>Loading API activity…</p> : usage.entries.map((entry) => <article className="coordinator-request-card" key={entry.id}>
        <div className="coordinator-request-heading"><span><strong>{entry.method} {entry.endpoint}</strong><small>{entry.apiName} · {entry.consumerId || "unauthorized request"} · {new Date(entry.timestamp).toLocaleString()}</small></span><StatusTag tone={entry.statusCode < 400 ? "green" : "orange"}>{entry.statusCode}</StatusTag></div>
        <small>{entry.durationMs} ms · {entry.outcome}</small>
      </article>)}
      {!usageLoading && !usage.entries.length && <Empty icon={Code2} title="No API requests yet." text="Protected demo endpoint activity will appear here." />}
      </section>
    </>}
  </div>;
}

export function NotificationsPage() {
const { data, loading, error } = useLoad("/notifications", []);
return <div className="page-content platform-page"><Heading eyebrow="NOTHING IMPORTANT GETS LOST" title={<>Your campus <em>at a glance.</em></>} subtitle="Deadlines, course updates, and campus announcements in one place." />
  {error && <FormNotice error={error} />}{loading ? <section className="panel">Checking for updates…</section> : <section className="panel notification-list">
    {data.map((item) => <article className="notification-row" key={item.id}><span className={`notification-kind ${item.kind}`}><CircleAlert size={17} /></span><span><strong>{item.title}</strong><p>{item.detail}</p><small>{item.date}</small></span></article>)}
    {!data.length && <div className="empty-state"><CircleCheck size={24} /><strong>You're all caught up.</strong><p>Deadlines and campus updates will appear here.</p></div>}
  </section>}
</div>;
}

export function GamificationPage() {
const { data, loading, error } = useLoad("/gamification", { points: 0, streak: 0, badges: [], leaderboard: [] });
return <div className="page-content platform-page"><Heading eyebrow="SMALL STEPS DESERVE A HIGH FIVE" title={<>Your learning <em>momentum.</em></>} subtitle="Earn points from lessons and quizzes, collect badges, and celebrate steady progress." />
  {error && <FormNotice error={error} />}{loading ? <section className="panel">Loading achievements…</section> : <>
    <div className="platform-stats-row"><article className="platform-stat"><span>Learning points</span><strong>{data.points}</strong><small>From completed lessons and quizzes</small></article><article className="platform-stat"><span>Learning streak</span><strong>{data.streak} days</strong><small>Keep a steady weekly rhythm</small></article><article className="platform-stat"><span>Badges</span><strong>{data.badges.length}</strong><small>{data.badges.join(" · ") || "Your first badge is waiting"}</small></article></div>
    <section className="panel leaderboard-panel"><div className="panel-heading"><div><span className="eyebrow">CELEBRATE THE JOURNEY</span><h3>Campus leaderboard</h3></div><Award size={20} /></div>
      {data.leaderboard.map((learner) => <div className={`leaderboard-row ${learner.isMe ? "leaderboard-me" : ""}`} key={`${learner.rank}-${learner.name}`}><span className="leaderboard-rank">{String(learner.rank).padStart(2, "0")}</span><span className="discussion-avatar">{learner.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><strong>{learner.name}{learner.isMe ? " · You" : ""}</strong><span>{learner.badges.join(", ")}</span><b>{learner.points} pts</b></div>)}
      {!data.leaderboard.length && <div className="empty-state"><Award size={23} /><strong>The leaderboard is ready for you.</strong><p>Complete a lesson or quiz to earn your first points.</p></div>}
    </section>
  </>}
</div>;
}

export function ReportsPage() {
const { data, loading, error } = useLoad("/admin/reports", { learners: 0, staff: 0, courses: 0, assignments: 0, pendingReviews: 0, attendancePercent: 0 });
const cards = [["Learners", data.learners, Users], ["Staff", data.staff, BriefcaseBusiness], ["Courses", data.courses, BookOpen], ["Assignments", data.assignments, FileCheck2], ["Reviews pending", data.pendingReviews, Clock3], ["Attendance", `${data.attendancePercent}%`, CalendarDays]];
return <div className="page-content platform-page"><Heading eyebrow="CAMPUS-WIDE SNAPSHOT" title={<>A clearer view of <em>how campus is doing.</em></>} subtitle="Coordinator and administrator summary of learning activity and course operations." />
  {error && <FormNotice error={error} />}{loading ? <section className="panel">Loading campus report…</section> : <div className="platform-stats-row report-cards">{cards.map(([title, value, Icon]) => <article className="platform-stat report-stat" key={title}><span><Icon size={15} /> {title}</span><strong>{value}</strong><small>Current campus records</small></article>)}</div>}
</div>;
}
export function AssignmentsPage({ user, courses }) {
  const { data, setData, loading, error, reload } = useLoad("/assignments", []);
  const [form, setForm] = useState({ title: "", courseId: courses[0]?.id || "", detail: "", due: "", points: 100 });
  const [submission, setSubmission] = useState(null);
  const [review, setReview] = useState(null);
  const [file, setFile] = useState(null);
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const canCreate = ["trainer", "administrator"].includes(user.role);
  const coordinatorView = user.role === "coordinator";
  const coordinatorPending = coordinatorView
    ? data.reduce((total, item) => total + (item.pendingLearners?.length || 0), 0)
    : 0;
  const coordinatorOverdue = coordinatorView
    ? data.filter((item) => item.due < new Date().toISOString().slice(0, 10) && item.pendingLearners?.length).length
    : 0;
  const trainerReviewsPending = coordinatorView
    ? data.reduce((total, item) => total + (item.submissions || []).filter((submission) => submission.status !== "reviewed").length, 0)
    : 0;
  async function createAssignment(event) {
    event.preventDefault(); setBusy(true); setFormError("");
    try {
      const item = await api("/assignments", { method: "POST", body: JSON.stringify({ ...form, points: Number(form.points) }) });
      setData([item, ...data]); setNotice("Assignment shared with course learners."); setForm({ ...form, title: "", detail: "" });
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  }
  async function submitWork(event) {
    event.preventDefault(); setBusy(true); setFormError("");
    try {
      let attachment;
      if (file) {
        if (file.size > 512 * 1024) throw new Error("Choose a file smaller than 512 KB.");
        attachment = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
          reader.onerror = () => reject(new Error("Could not read that file."));
          reader.readAsDataURL(file);
        });
      }
      await api(`/assignments/${submission.id}/submissions`, { method: "POST", body: JSON.stringify({ link, text, file: attachment }) });
      setSubmission(null); setFile(null); setLink(""); setText(""); setNotice("Your work is submitted for trainer review."); await reload();
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  }
  async function reviewWork(event) {
    event.preventDefault(); setBusy(true); setFormError("");
    try {
      await api(`/assignments/submissions/${review.submission.id}/review`, { method: "PATCH", body: JSON.stringify({ marks: Number(review.marks), feedback: review.feedback }) });
      setReview(null); setNotice("Marks and feedback saved."); await reload();
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="page-content platform-page"><Heading eyebrow={user.role === "coordinator" ? "MONITOR LEARNER PROGRESS" : "DO THE WORK, SEE IT GROW"} title={user.role === "coordinator" ? <>Track the work. <em>Support progress.</em></> : <>Assignments & <em>projects.</em></>} subtitle={user.role === "coordinator" ? "Review due dates, batch submission status, overdue learners, and trainer evaluations. Trainers retain responsibility for grading." : "Clear deadlines, secure file and project-link submissions, and trainer feedback."} />
    {canCreate && <form className="panel platform-form" onSubmit={createAssignment}><div className="panel-heading"><div><span className="eyebrow">TRAINER WORKSPACE</span><h3>Share an assignment</h3></div><FileCheck2 size={19} /></div><div className="platform-form-grid">
      <label>Assignment title<input maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
      <label>Course<select value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })}>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
      <label>Due date<input type="date" value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} required /></label>
      <label>Points<input type="number" min="1" max="1000" value={form.points} onChange={(event) => setForm({ ...form, points: event.target.value })} required /></label>
    </div><label>Instructions<textarea rows="3" maxLength="2000" value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} required /></label><FormNotice error={formError} notice={notice} /><button className="button button-primary" disabled={busy}>Share assignment <Plus size={14} /></button></form>}
    {!canCreate && <FormNotice error={formError} notice={notice} />}
    {coordinatorView && <div className="platform-stats-row report-cards coordinator-assignment-stats"><article className="platform-stat report-stat"><span><FileCheck2 size={15} /> Work outstanding</span><strong>{coordinatorPending}</strong><small>Not submitted or awaiting review</small></article><article className="platform-stat report-stat"><span><Clock3 size={15} /> Overdue assignments</span><strong>{coordinatorOverdue}</strong><small>Past due with outstanding learners</small></article><article className="platform-stat report-stat"><span><Users size={15} /> Trainer evaluations pending</span><strong>{trainerReviewsPending}</strong><small>Trainer responsibility</small></article></div>}
    <section className="panel platform-assignment-list"><div className="panel-heading"><div><span className="eyebrow">{user.role === "student" ? "YOUR COURSEWORK" : "LEARNER SUBMISSIONS"}</span><h3>Assignment tracker</h3></div></div>
      {loading && <p>Loading assignments…</p>}{error && <p className="form-error">{error}</p>}
      {!loading && !data.length && <div className="empty-state"><FileCheck2 size={24} /><strong>No assignments yet.</strong><p>New course assignments will appear here.</p></div>}
      {data.map((item) => <article className={`platform-assignment-row ${item.kind === "project" ? "platform-assignment-project" : ""}`} key={item.id}><span className="assignment-row-icon">{item.kind === "project" ? <BriefcaseBusiness size={17} /> : <FileCheck2 size={17} />}</span><div className="assignment-row-copy">
        <span className="course-category">{item.kind === "project" ? `FINAL CAPSTONE PROJECT · ${item.points} points` : `${item.course} · ${item.points} points`}</span><strong>{item.title}</strong><p>{item.detail}</p><small><CalendarDays size={13} /> Due {new Date(`${item.due}T12:00:00`).toLocaleDateString()}</small>
        {!canCreate && item.submission?.feedback && <p className="assignment-feedback"><MessageCircle size={13} /> {item.submission.feedback}</p>}
        {!canCreate && item.submission?.file && <a href={`/api/assignments/submissions/${item.submission.id}/file`}><Download size={13} /> {item.submission.file.name}</a>}
        {!canCreate && item.submission?.link && <a href={item.submission.link} target="_blank" rel="noreferrer">Open project link <ArrowRight size={13} /></a>}
      </div>{!canCreate && <span className="pill">{item.submission?.status === "reviewed" ? `${item.submission.marks}/${item.points} marks` : item.submission ? "Submitted" : new Date(`${item.due}T23:59:59`) < new Date() ? "Overdue" : "Pending"}</span>}
      {user.role === "student" && <button className="button button-outline button-small" disabled={item.submission?.status === "reviewed"} onClick={() => setSubmission(item)}>{item.submission?.status === "reviewed" ? "Graded" : item.submission ? "Update submission" : item.kind === "project" ? "Start project" : "Submit work"}</button>}
      {(canCreate || user.role === "coordinator") && (item.submissions || [item.submission].filter(Boolean)).map((studentSubmission) => <div className="trainer-submission-review-row" key={studentSubmission.id}><span><strong>{studentSubmission.student}</strong><small>{studentSubmission.status === "reviewed" ? `${studentSubmission.marks}/${item.points} · Reviewed` : "Submitted · awaiting trainer evaluation"}</small>{studentSubmission.text && <small>{studentSubmission.text}</small>}{studentSubmission.file && <a href={`/api/assignments/submissions/${studentSubmission.id}/file`}><Download size={13} /> {studentSubmission.file.name}</a>}{studentSubmission.link && <a href={studentSubmission.link} target="_blank" rel="noreferrer">Open project link <ArrowRight size={13} /></a>}</span>{canCreate && <button className="button button-outline button-small" onClick={() => setReview({ item, submission: studentSubmission, marks: studentSubmission.marks ?? "", feedback: studentSubmission.feedback || "" })}>{studentSubmission.status === "reviewed" ? "Edit review" : "Evaluate"}</button>}</div>)}
      {coordinatorView && item.pendingLearners?.length > 0 && <div className="coordinator-pending-learners"><strong>Needs follow-up ({item.pendingLearners.length})</strong>{item.pendingLearners.map((learner) => <span key={learner.id}>{learner.name}<small>{learner.status === "not_submitted" ? "Not submitted" : "Awaiting trainer evaluation"}</small></span>)}</div>}
      </article>)}
    </section>
    {submission && <div className="platform-modal-scrim"><section className="platform-modal" role="dialog" aria-modal="true"><div className="platform-modal-heading"><div><span className="eyebrow">SUBMIT YOUR WORK</span><h2>{submission.title}</h2></div><button className="button button-outline" onClick={() => setSubmission(null)}>Close</button></div><p className="modal-context">{submission.detail}<br />Due {new Date(`${submission.due}T12:00:00`).toLocaleDateString()} · files under 512 KB</p><form className="modal-form" onSubmit={submitWork}>
      <label>Attach a PDF, text, or Markdown file<input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
      <label>Or share a project link<input type="url" placeholder="https://…" value={link} onChange={(event) => setLink(event.target.value)} /></label>
      <label>Or write a response<textarea maxLength="3000" rows="3" value={text} onChange={(event) => setText(event.target.value)} /></label>
      <FormNotice error={formError} /><button className="button button-primary" disabled={busy}>Submit assignment <Send size={14} /></button>
    </form></section></div>}
    {review && <div className="platform-modal-scrim"><section className="platform-modal" role="dialog" aria-modal="true"><div className="platform-modal-heading"><div><span className="eyebrow">TRAINER REVIEW</span><h2>{review.item.title}</h2></div><button className="button button-outline" onClick={() => setReview(null)}>Close</button></div><p className="modal-context">{review.submission.student} · {review.submission.late ? "Submitted late" : "Submitted on time"}<br />{review.submission.text}</p><form className="modal-form" onSubmit={reviewWork}>
      <label>Marks (out of {review.item.points})<input type="number" min="0" max={review.item.points} value={review.marks} onChange={(event) => setReview({ ...review, marks: event.target.value })} required /></label>
      <label>Feedback<textarea rows="4" maxLength="1000" value={review.feedback} onChange={(event) => setReview({ ...review, feedback: event.target.value })} required /></label>
      <FormNotice error={formError} /><button className="button button-primary" disabled={busy}>Save marks & feedback <Check size={14} /></button>
    </form></section></div>}
  </div>;
}

export function AnalyticsPage() {
  const { data, loading, error } = useLoad("/analytics", { months: [], byCourse: [], attendancePercent: 0, quizAverage: 0 });
  return <div className="page-content platform-page"><Heading eyebrow="SHOW UP, REFLECT, GROW" title={<>Your progress, <em>made visible.</em></>} subtitle="Review monthly attendance, course performance, quiz results, and marks." />
    {error && <FormNotice error={error} />}{loading ? <section className="panel">Loading analytics…</section> : <>
      <div className="platform-stats-row"><article className="platform-stat"><span>Attendance</span><strong>{data.attendancePercent}%</strong><small>Recorded classes attended</small></article><article className="platform-stat"><span>Quiz average</span><strong>{data.quizAverage}%</strong><small>Across quiz attempts</small></article><article className="platform-stat"><span>Assignment marks</span><strong>{data.assignmentAverage === null ? "—" : `${data.assignmentAverage}%`}</strong><small>Reviewed submissions</small></article></div>
      <section className="panel platform-chart"><div className="panel-heading"><div><span className="eyebrow">LAST SIX MONTHS</span><h3>Monthly attendance</h3></div><CalendarDays size={19} /></div><div className="monthly-bars">{data.months.map((month) => <div className="monthly-bar-column" key={month.month}><span className="monthly-bar-track"><i style={{ height: `${month.total ? Math.max(6, month.attended / month.total * 100) : 3}%` }} /></span><strong>{month.total ? `${Math.round(month.attended / month.total * 100)}%` : "—"}</strong><small>{month.label}</small></div>)}</div></section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ATTENDANCE BY SUBJECT</span><h3>Course performance</h3></div></div>{data.byCourse.map((course) => <div className="analytics-course-row" key={course.courseId}><div><strong>{course.course}</strong><small>{course.lowAttendance ? <><CircleAlert size={13} /> Below 75% — follow up with your trainer</> : "Attendance"}</small></div><div className="progress-track"><span className={course.lowAttendance ? "attendance-low" : ""} style={{ width: `${course.attendance}%` }} /></div><strong>{course.attendance}%</strong></div>)}</section>
    </>}</div>;
}

export function TrainerReportsPage() {
  const { data, loading, error } = useLoad("/trainer/overview", {
    students: [], courses: [], batches: [], attendancePercent: 0, pendingEvaluations: 0
  });
  return <div className="page-content platform-page"><Heading eyebrow="TRAINER REPORTS" title={<>See where learners <em>are growing.</em></>} subtitle="Review course participation, attendance, and assignment activity for your students." />
    {error && <FormNotice error={error} />}
    {loading ? <section className="panel">Loading student progress…</section> : <>
      <div className="platform-stats-row"><article className="platform-stat"><span>Assigned students</span><strong>{data.students.length}</strong><small>Across your courses and batches</small></article><article className="platform-stat"><span>Attendance summary</span><strong>{data.attendancePercent}%</strong><small>Present or late across your classes</small></article><article className="platform-stat"><span>Evaluations pending</span><strong>{data.pendingEvaluations}</strong><small>Submissions awaiting feedback</small></article></div>
      <section className="panel trainer-progress-panel"><div className="panel-heading"><div><span className="eyebrow">STUDENT-WISE REPORT</span><h3>Progress and feedback</h3></div><Users size={19} /></div>
        <div className="table-wrap"><table><thead><tr><th>STUDENT</th><th>COURSES</th><th>ATTENDANCE</th><th>WORK SUBMITTED</th><th>REVIEWED</th><th>AVERAGE MARKS</th><th>LESSONS COMPLETE</th></tr></thead><tbody>{data.students.map((student) => <tr key={student.id}><td><strong>{student.name}</strong><small className="trainer-student-email">{student.email}</small>{student.skills && <small className="trainer-student-email">Skills: {student.skills}</small>}</td><td>{student.courses.join(", ") || "—"}</td><td>{student.attendancePercent}%</td><td>{student.assignmentsSubmitted}</td><td>{student.assignmentsReviewed}</td><td>{student.marksAverage === null ? "—" : `${student.marksAverage}%`}</td><td>{student.completedLessons}</td></tr>)}</tbody></table>{!data.students.length && <p className="trainer-empty-note">Students will appear here after they enroll in one of your courses.</p>}</div>
      </section>
    </>}
  </div>;
}

export function TimetablePage({ user, courses }) {
  const { data, loading, error, reload } = useLoad("/timetable", []);
  const { data: trainers } = useLoad(user.role === "student" ? "/courses" : "/trainers", []);
  const { data: batches } = useLoad(user.role === "student" ? "/courses" : "/batches", []);
  const initialForm = { title: "", courseId: courses[0]?.id || "", day: "Monday", startTime: "10:00", endTime: "11:00", trainer: user.role === "trainer" ? user.name : "", room: "", batchId: "", meetingUrl: "" };
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = ["trainer", "coordinator", "administrator"].includes(user.role);
  const coordinatorCanSchedule = ["coordinator", "administrator"].includes(user.role);
  function resetForm() {
    setEditingId("");
    setForm({ ...initialForm, courseId: courses[0]?.id || "" });
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setFormError("");
    try {
      await api(editingId ? `/timetable/${editingId}` : "/timetable", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(form)
      });
      setNotice(editingId ? "Class details updated." : "Class added to the timetable.");
      resetForm();
      await reload();
    }
    catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  }
  async function toggleClassStatus(item) {
    setFormError(""); setNotice("");
    try {
      await api(`/timetable/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...item,
          status: item.status === "completed" ? "upcoming" : "completed"
        })
      });
      setNotice(item.status === "completed" ? "Class marked as upcoming." : "Class marked as completed.");
      await reload();
    } catch (err) { setFormError(err.message); }
  }
  return <div className="page-content platform-page"><Heading eyebrow="PLAN YOUR WEEK" title={<>A timetable with <em>room to grow.</em></>} subtitle="Find your next class, trainer, room, and course deadline." />
    {error && <FormNotice error={error} />}
    {canManage && <form className="panel platform-form" onSubmit={save}><div className="panel-heading"><div><span className="eyebrow">{user.role === "trainer" ? "MY COURSE SCHEDULE" : "COORDINATOR WORKSPACE"}</span><h3>{editingId ? "Update class details" : "Schedule a class"}</h3></div>{editingId && <button className="button button-outline" type="button" onClick={resetForm}>Cancel</button>}</div><div className="platform-form-grid">
      <label>Class title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
      <label>Course<select value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })}>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
      <label>Day<select value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })}>{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => <option key={day}>{day}</option>)}</select></label>
      {coordinatorCanSchedule && <label>Trainer<select value={form.trainer} onChange={(event) => setForm({ ...form, trainer: event.target.value })} required><option value="">Choose trainer</option>{trainers.map((trainer) => <option key={trainer.id} value={trainer.name}>{trainer.name}</option>)}</select></label>}
      {coordinatorCanSchedule && <label>Batch<select value={form.batchId} onChange={(event) => setForm({ ...form, batchId: event.target.value })}><option value="">No specific batch</option>{batches.filter((batch) => !form.courseId || batch.courseId === form.courseId).map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></label>}
      <label>Starts<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required /></label>
      <label>Ends<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} required /></label>
      <label>Room<input value={form.room} onChange={(event) => setForm({ ...form, room: event.target.value })} required /></label>
      {coordinatorCanSchedule && <label className="platform-form-wide">Meeting link (optional)<input type="url" value={form.meetingUrl} onChange={(event) => setForm({ ...form, meetingUrl: event.target.value })} placeholder="https://…" /></label>}
    </div><FormNotice error={formError} notice={notice} /><button className="button button-primary" disabled={busy}>{editingId ? "Save class" : "Add to timetable"} <Plus size={14} /></button></form>}
    <section className="panel timetable-list"><div className="panel-heading"><div><span className="eyebrow">WEEKLY CLASSES</span><h3>Coming up</h3></div><Clock3 size={19} /></div>
      {loading ? <p>Loading timetable…</p> : data.map((item) => <article className="timetable-row" key={item.id}><span className="timetable-day">{item.day.slice(0, 3)}</span><span className="timetable-time">{item.startTime}<small>to {item.endTime}</small></span><span className="timetable-class"><strong>{item.title}</strong><small>{item.course} · {item.trainer}{item.batchId ? ` · ${batches.find((batch) => batch.id === item.batchId)?.name || "Assigned batch"}` : ""}</small><small>{item.status === "completed" ? "Completed session" : "Upcoming session"}{item.meetingUrl ? <> · <a href={item.meetingUrl} target="_blank" rel="noreferrer">Meeting link</a></> : ""}</small></span><span className="timetable-room">{item.room}</span>{canManage && <><button className="button button-outline button-small" onClick={() => { setEditingId(item.id); setForm({ ...initialForm, title: item.title, courseId: item.courseId, day: item.day, startTime: item.startTime, endTime: item.endTime, trainer: item.trainer, room: item.room, batchId: item.batchId || "", meetingUrl: item.meetingUrl || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button><button className="button button-outline button-small" onClick={() => toggleClassStatus(item)}>{item.status === "completed" ? "Reopen" : "Complete"}</button></>}</article>)}
    </section></div>;
}

export function EventsPage({ user }) {
  const { data, loading, error, reload } = useLoad("/events", []);
  const [form, setForm] = useState({ title: "", description: "", date: "", startTime: "10:00", location: "", category: "Workshop", capacity: 40 });
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [editingId, setEditingId] = useState("");
  const canManage = ["coordinator", "administrator"].includes(user.role);
  function resetForm() {
    setEditingId("");
    setForm({ title: "", description: "", date: "", startTime: "10:00", location: "", category: "Workshop", capacity: 40 });
  }
  async function save(event) {
    event.preventDefault(); setBusyId("publish"); setFormError(""); setNotice("");
    try {
      await api(editingId ? `/events/${editingId}` : "/events", { method: editingId ? "PATCH" : "POST", body: JSON.stringify({ ...form, capacity: Number(form.capacity) }) });
      setNotice(editingId ? "Campus event details updated and attendees notified." : "Campus event published.");
      resetForm(); await reload();
    } catch (err) { setFormError(err.message); }
    finally { setBusyId(""); }
  }
  async function register(item) {
    setBusyId(item.id); setFormError(""); setNotice("");
    try { await api(`/events/${item.id}/register`, { method: "POST", body: "{}" }); setNotice(`You're registered for ${item.title}.`); await reload(); }
    catch (err) { setFormError(err.message); }
    finally { setBusyId(""); }
  }
  async function remove(item) {
    setBusyId(item.id); setFormError(""); setNotice("");
    try { await api(`/events/${item.id}`, { method: "DELETE" }); setNotice("Event cancelled."); await reload(); }
    catch (err) { setFormError(err.message); }
    finally { setBusyId(""); }
  }
  function edit(item) {
    setEditingId(item.id);
    setForm({
      title: item.title, description: item.description, date: item.date, startTime: item.startTime,
      location: item.location, category: item.category, capacity: item.capacity
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return <div className="page-content platform-page"><Heading eyebrow="WHAT'S HAPPENING ON CAMPUS" title={<>Make room for <em>something good.</em></>} subtitle="Workshops, showcases, and career events, all in one place." />
    {(error || formError || notice) && <FormNotice error={error || formError} notice={notice} />}
    {canManage && <form className="panel platform-form" onSubmit={save}><div className="panel-heading"><div><span className="eyebrow">COORDINATOR WORKSPACE</span><h3>{editingId ? "Update campus event" : "Publish a campus event"}</h3></div>{editingId ? <button className="button button-outline button-small" type="button" onClick={resetForm}>Cancel</button> : <CalendarDays size={19} />}</div><div className="platform-form-grid">
      <label>Event title<input maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
      <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{["Workshop", "Showcase", "Career", "Community", "Other"].map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>Date<input type="date" min={new Date().toISOString().slice(0, 10)} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label>
      <label>Start time<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required /></label>
      <label>Location<input maxLength="120" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} required /></label>
      <label>Capacity<input type="number" min="1" max="500" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} required /></label>
      <label className="platform-form-wide">Description<textarea maxLength="1000" rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></label>
    </div><button className="button button-primary" disabled={busyId === "publish"}>{busyId === "publish" ? "Saving…" : editingId ? "Save event" : "Publish event"} <Plus size={14} /></button></form>}
    <section className="event-grid"><div className="panel-heading"><div><span className="eyebrow">SAVE YOUR SPOT</span><h3>Upcoming events</h3></div><CalendarDays size={19} /></div>
      {loading && <p>Loading campus events…</p>}
      {!loading && !error && !data.length && <div className="empty-state"><CalendarDays size={23} /><strong>{canManage ? "No upcoming events." : "Nothing scheduled yet."}</strong><p>{canManage ? "Publish a new campus event above to let students register." : "Check back when a coordinator publishes a new campus event."}</p></div>}
      {data.map((item) => <article className="panel event-card" key={item.id}><div className="event-card-date"><strong>{new Date(`${item.date}T12:00:00`).toLocaleDateString("en", { day: "2-digit" })}</strong><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString("en", { month: "short" })}</small></div><div className="event-card-main"><span className="eyebrow">{item.category}</span><h3>{item.title}</h3><p>{item.description}</p><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString("en", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · {item.startTime} · {item.location}</small><small>{item.registrationCount} / {item.capacity} places reserved</small></div>
        {user.role === "student" && <button className="button button-primary button-small" disabled={item.registered || item.registrationCount >= item.capacity || busyId === item.id} onClick={() => register(item)}>{item.registered ? "Registered" : item.registrationCount >= item.capacity ? "Full" : "Register"}</button>}
        {canManage && <><button className="button button-outline button-small" disabled={busyId === item.id} onClick={() => edit(item)}>Edit</button><button className="button button-outline button-small" disabled={busyId === item.id} onClick={() => remove(item)}>Cancel event</button></>}
      </article>)}
    </section>
  </div>;
}

export function BatchesPage({ courses, user }) {
  const { data, loading, error, reload } = useLoad("/batches", []);
  const { data: learners } = useLoad("/learners", []);
  const { data: trainers } = useLoad("/trainers", []);
  const [form, setForm] = useState({ name: "", courseId: courses[0]?.id || "", trainerId: "", capacity: 30, startDate: "", endDate: "", status: "upcoming" });
  const [editingId, setEditingId] = useState("");
  const [allocations, setAllocations] = useState({});
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = ["coordinator", "administrator"].includes(user.role);
  function resetForm() {
    setEditingId("");
    setForm({ name: "", courseId: courses[0]?.id || "", trainerId: "", capacity: 30, startDate: "", endDate: "", status: "upcoming" });
  }
  async function create(event) {
    event.preventDefault(); setBusy(true); setFormError(""); setNotice("");
    try {
      const payload = { ...form, capacity: Number(form.capacity) };
      await api(editingId ? `/batches/${editingId}` : "/batches", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setNotice(editingId ? "Batch details and trainer assignment updated." : "Batch created and ready for learner allocation.");
      resetForm(); await reload();
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  }
  async function allocate(batch) {
    const learnerId = allocations[batch.id];
    if (!learnerId) { setFormError("Choose a learner to allocate."); return; }
    setBusy(true); setFormError(""); setNotice("");
    try {
      await api(`/batches/${batch.id}/learners`, { method: "POST", body: JSON.stringify({ learnerId }) });
      setNotice("Learner allocated and enrolled in this batch course."); await reload();
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  }
  async function removeLearner(batch, learner) {
    setBusy(true); setFormError(""); setNotice("");
    try {
      await api(`/batches/${batch.id}/learners/${learner.id}`, { method: "DELETE" });
      setNotice(`${learner.name} was removed from ${batch.name}.`);
      await reload();
    } catch (err) { setFormError(err.message); }
    finally { setBusy(false); }
  }
  function editBatch(batch) {
    setEditingId(batch.id);
    setForm({
      name: batch.name, courseId: batch.courseId, trainerId: batch.trainerId,
      capacity: batch.capacity, startDate: batch.startDate, endDate: batch.endDate || "", status: batch.status || "active"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return <div className="page-content platform-page"><Heading eyebrow="COORDINATE LEARNING AT SCALE" title={<>Batches built for <em>steady progress.</em></>} subtitle="Create course cohorts, assign trainers, and allocate learners with capacity checks." />
    {(error || formError || notice) && <FormNotice error={error || formError} notice={notice} />}
    {canManage && <form className="panel platform-form" onSubmit={create}><div className="panel-heading"><div><span className="eyebrow">BATCH SETUP</span><h3>{editingId ? "Update batch details" : "Create a course batch"}</h3></div>{editingId ? <button className="button button-outline button-small" type="button" onClick={resetForm}>Cancel</button> : <Users size={19} />}</div><div className="platform-form-grid">
      <label>Batch name<input maxLength="120" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Java · November cohort" required /></label>
      <label>Course<select value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })}>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
      <label>Trainer<select value={form.trainerId} onChange={(event) => setForm({ ...form, trainerId: event.target.value })} required><option value="">Select a trainer</option>{trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.name}</option>)}</select></label>
      <label>Start date<input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required /></label>
      <label>End date<input type="date" min={form.startDate} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
      <label>Capacity<input type="number" min="1" max="200" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} required /></label>
      {editingId && <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option></select></label>}
    </div><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : editingId ? "Save batch" : "Create batch"} <Plus size={14} /></button></form>}
    <section className="batch-list"><div className="panel-heading"><div><span className="eyebrow">{user.role === "trainer" ? "MY ASSIGNED COHORTS" : "ACTIVE COHORTS"}</span><h3>{user.role === "trainer" ? "Courses & batches" : "Batch allocation"}</h3></div><Users size={19} /></div>
      {loading && <section className="panel">Loading batches…</section>}
      {!loading && !data.length && <section className="panel empty-state"><Users size={23} /><strong>No batches yet.</strong><p>Create a cohort, then add enrolled learners.</p></section>}
      {data.map((batch) => <article className="panel batch-card" key={batch.id}><div className="batch-card-heading"><div><span className="eyebrow">{batch.course}</span><h3>{batch.name}</h3><p>{batch.trainer} · {new Date(`${batch.startDate}T12:00:00`).toLocaleDateString()}{batch.endDate ? ` – ${new Date(`${batch.endDate}T12:00:00`).toLocaleDateString()}` : ""}</p></div><span className={`pill ${batch.status === "active" ? "pill-green" : batch.status === "completed" ? "pill-blue" : ""}`}>{batch.status}</span><strong>{batch.learners.length} / {batch.capacity}<small> learners</small></strong>{canManage && <button className="button button-outline button-small" onClick={() => editBatch(batch)}>Edit</button>}</div><div className="batch-learner-list">{batch.learners.map((learner) => <span className="batch-learner-chip" key={learner.id}>{learner.name}{canManage && <button type="button" aria-label={`Remove ${learner.name} from ${batch.name}`} disabled={busy} onClick={() => removeLearner(batch, learner)}>×</button>}</span>)}{!batch.learners.length && <small>No learners allocated yet.</small>}</div>{canManage && <form className="batch-allocate-row" onSubmit={(event) => { event.preventDefault(); allocate(batch); }}><label htmlFor={`learner-${batch.id}`}>Allocate learner</label><select id={`learner-${batch.id}`} value={allocations[batch.id] || ""} onChange={(event) => setAllocations({ ...allocations, [batch.id]: event.target.value })}><option value="">Choose a learner</option>{learners.filter((learner) => !batch.learners.some((member) => member.id === learner.id)).map((learner) => <option key={learner.id} value={learner.id}>{learner.name} · {learner.email}</option>)}</select><button className="button button-outline button-small" disabled={busy || batch.learners.length >= batch.capacity}><Plus size={13} /> Allocate</button></form>}</article>)}
    </section>
  </div>;
}

export function LearningPathPage() {
  const { data, setData, loading, error } = useLoad("/learning-path", { goal: "Web Developer", weeks: [] });
  const [notice, setNotice] = useState("");
  async function update(goal) {
    setNotice("");
    try { setData(await api("/learning-path", { method: "PATCH", body: JSON.stringify({ goal }) })); setNotice("Your personalized path is saved."); }
    catch (err) { setNotice(err.message); }
  }
  return <div className="page-content platform-page"><Heading eyebrow="A PLAN THAT FITS YOUR GOAL" title={<>A learning path, <em>made for you.</em></>} subtitle="Choose a career direction and get clear weekly learning targets." />
    {error && <FormNotice error={error} />}{loading ? <section className="panel">Loading your path…</section> : <>
      <section className="panel path-picker"><span className="eyebrow">MY CAREER GOAL</span><label htmlFor="career-goal">Choose a direction</label><select id="career-goal" value={data.goal} onChange={(event) => update(event.target.value)}>{["Java Developer", "AI / ML Engineer", "Web Developer", "Data Analyst"].map((goal) => <option key={goal}>{goal}</option>)}</select><p>Recommendations match courses to your goal. Change your choice any time.</p>{notice && <p className="form-success">{notice}</p>}</section>
      <div className="path-weeks">{data.weeks.map((week) => <article className="panel path-week" key={week.week}><span className="path-week-number">WEEK {String(week.week).padStart(2, "0")}</span><span className="path-week-mark"><Sparkles size={17} /></span><h3>{week.title}</h3><small>Course {week.courseId} · suggested target</small></article>)}</div>
    </>}</div>;
}

export function AssistantPage() {
  const { data: providerStatus } = useLoad("/ai/status", { mode: "local", missing: [] });
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hi! I can explain programming topics, check pending assignments, and help make a study plan. What are you working on?" }]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("local");
  async function send(event) {
    event.preventDefault();
    if (!message.trim() || busy) return;
    const question = message.trim();
    setMessages((items) => [...items, { role: "user", content: question }]);
    setMessage(""); setBusy(true); setError("");
    try {
      const result = await api("/ai/assistant", { method: "POST", body: JSON.stringify({ message: question }) });
      setMode(result.mode); setMessages((items) => [...items, { role: "assistant", content: result.answer }]);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="page-content platform-page"><Heading eyebrow="A HELPFUL CAMPUS COMPANION" title={<>Ask, explore, <em>keep growing.</em></>} subtitle="Help with concepts, assignments, and study plans. Provider credentials stay on the server." /><section className="panel assistant-panel">
    <div className="assistant-header"><span className="assistant-avatar"><Sparkles size={19} /></span><span><strong>Zyngram Campus Assistant</strong><small>{mode === "provider" ? "Connected AI provider" : providerStatus.mode === "incomplete" ? "AI setup incomplete · configure private server environment" : "Private local study guidance"}</small></span><span className="assistant-live">READY</span></div>
    <div className="assistant-messages" aria-live="polite">{messages.map((item, index) => <article className={`assistant-message ${item.role === "user" ? "from-user" : ""}`} key={`${item.role}-${index}`}><span>{item.role === "user" ? "YOU" : "ZYNGRAM ASSISTANT"}</span><p>{item.content}</p></article>)}{busy && <p className="assistant-thinking">Putting together a helpful answer…</p>}</div>
    <FormNotice error={error} /><form className="assistant-input-row" onSubmit={send}><label className="sr-only" htmlFor="assistant-question">Ask the campus assistant</label><textarea id="assistant-question" rows="2" maxLength="1500" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask about Java, pending assignments, or a study plan…" required /><button className="button button-primary" disabled={busy || !message.trim()} aria-label="Send message"><Send size={16} /></button></form>
    <div className="assistant-suggestions">{["Explain Java inheritance", "What assignments are pending?", "Prepare a study plan for me"].map((sample) => <button key={sample} onClick={() => setMessage(sample)}>{sample}</button>)}</div>
  </section><p className="assistant-privacy"><CircleCheck size={16} /> Don't share passwords or sensitive personal information in chat.</p></div>;
}

  export function CommunityPage({ user }) {
    const { data, loading, error, reload } = useLoad("/community", { posts: [], groups: [] });
    const [form, setForm] = useState({ title: "", body: "" });
    const [groupForm, setGroupForm] = useState({ name: "", topic: "", schedule: "" });
    const [replies, setReplies] = useState({});
    const [notice, setNotice] = useState("");
    const [formError, setFormError] = useState("");
    const [groupNotice, setGroupNotice] = useState("");
    const [busy, setBusy] = useState(false);
    async function post(event) {
      event.preventDefault(); setBusy(true); setFormError("");
      try { await api("/community/posts", { method: "POST", body: JSON.stringify(form) }); setForm({ title: "", body: "" }); setNotice("Your question is posted."); await reload(); }
      catch (err) { setFormError(err.message); }
      finally { setBusy(false); }
    }
    async function reply(event, item) {
      event.preventDefault(); setFormError("");
      try { await api(`/community/posts/${item.id}/comments`, { method: "POST", body: JSON.stringify({ body: replies[item.id] || "" }) }); setReplies({ ...replies, [item.id]: "" }); await reload(); }
      catch (err) { setFormError(err.message); }
    }
    async function join(group) {
      try { await api(`/community/groups/${group.id}/join`, { method: "POST", body: "{}" }); await reload(); }
      catch (err) { setFormError(err.message); }
    }
    async function createGroup(event) {
      event.preventDefault(); setFormError(""); setGroupNotice("");
      try {
        await api("/community/groups", { method: "POST", body: JSON.stringify(groupForm) });
        setGroupForm({ name: "", topic: "", schedule: "" }); setGroupNotice("Your study group is ready to join."); await reload();
      } catch (err) { setFormError(err.message); }
    }
    return <div className="page-content platform-page"><Heading eyebrow={user.role === "trainer" ? "STUDENT DOUBTS & Q&A" : "LEARN BETTER, TOGETHER"} title={user.role === "trainer" ? <>Help a learner <em>find the next step.</em></> : <>A campus community <em>that listens.</em></>} subtitle={user.role === "trainer" ? "Read student questions, share helpful answers, and follow the conversation." : "Ask questions, share what you learn, and find a study group."} />
      {user.role === "student" && <form className="panel platform-form community-post-form" onSubmit={post}><div className="panel-heading"><div><span className="eyebrow">START A DISCUSSION</span><h3>What are you working through?</h3></div><MessageCircle size={19} /></div><label>Question or topic<input maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Can someone explain SQL joins?" required /></label><label>Details<textarea rows="3" maxLength="1200" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required /></label><FormNotice error={formError} notice={notice} /><button className="button button-primary" disabled={busy}>Post question <Send size={14} /></button></form>}
      {error && <FormNotice error={error} />}
      <div className="community-layout"><section className="panel community-post-list"><div className="panel-heading"><div><span className="eyebrow">{user.role === "trainer" ? "QUESTIONS FROM LEARNERS" : "PEER-TO-PEER SUPPORT"}</span><h3>{user.role === "trainer" ? "Doubts to answer" : "Recent discussions"}</h3></div><Users size={19} /></div>
        {loading && <p>Loading campus questions…</p>}{!data.posts.length && <div className="empty-state"><MessageCircle size={23} /><strong>Start the first discussion.</strong><p>Share a question or a small win with classmates.</p></div>}
        {data.posts.map((item) => <article className="discussion-card" key={item.id}><span className="discussion-avatar">{item.author.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div className="discussion-main"><div className="discussion-byline"><strong>{item.author}</strong><small>{new Date(item.createdAt).toLocaleDateString()}</small></div><h4>{item.title}</h4><p>{item.body}</p>{item.comments.map((comment) => <div className="discussion-reply" key={comment.id}><strong>{comment.author}</strong><span>{comment.body}</span></div>)}<form className="discussion-reply-form" onSubmit={(event) => reply(event, item)}><input maxLength="500" value={replies[item.id] || ""} onChange={(event) => setReplies({ ...replies, [item.id]: event.target.value })} placeholder="Share a helpful reply…" required /><button aria-label="Send reply"><Send size={14} /></button></form></div></article>)}
      </section><section className="panel study-groups"><div className="panel-heading"><div><span className="eyebrow">MEET & MAKE PROGRESS</span><h3>Study groups</h3></div><Users size={18} /></div>
        {user.role === "student" && <form className="create-group-form" onSubmit={createGroup}><label>Start a group<input maxLength="100" value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} placeholder="e.g. Python project club" required /></label><label>Topic<input maxLength="160" value={groupForm.topic} onChange={(event) => setGroupForm({ ...groupForm, topic: event.target.value })} required /></label><label>Meeting plan<input maxLength="100" value={groupForm.schedule} onChange={(event) => setGroupForm({ ...groupForm, schedule: event.target.value })} placeholder="Saturdays · 11:00 AM" required /></label><FormNotice error={formError} notice={groupNotice} /><button className="button button-outline button-small"><Plus size={13} /> Create group</button></form>}
        {data.groups.map((group) => <article className="study-group-card" key={group.id}><span className="study-group-icon"><BookOpen size={17} /></span><div><strong>{group.name}</strong><p>{group.topic}</p><small>{group.schedule} · {group.memberCount} members</small></div>{user.role === "student" && <button className="button button-outline button-small" disabled={group.joined} onClick={() => join(group)}>{group.joined ? "Joined" : "Join"}</button>}</article>)}
      </section></div>
    </div>;
  }

  export function CareerPage({ user, courses = [] }) {
    const { data, setData, loading, error } = useLoad("/careers", { jobs: [], mockQuestions: [] });
    const [form, setForm] = useState({ title: "", organization: "", location: "", type: "Internship", description: "", applyUrl: "" });
    const [notice, setNotice] = useState("");
    const [formError, setFormError] = useState("");
    const [progress, setProgress] = useState(0);
    const canPost = ["placement_officer", "administrator"].includes(user.role);
    useEffect(() => { setProgress(data.placementProgress || 0); }, [data.placementProgress]);
    async function addJob(event) {
      event.preventDefault(); setFormError("");
      try {
        const job = await api("/careers/jobs", { method: "POST", body: JSON.stringify(form) });
        setData({ ...data, jobs: [job, ...data.jobs] }); setNotice("Opportunity posted to the placement board.");
      } catch (err) { setFormError(err.message); }
    }
    async function saveProgress() {
      setFormError("");
      try {
        const result = await api("/careers/progress", { method: "PATCH", body: JSON.stringify({ progress: Number(progress) }) });
        setData({ ...data, placementProgress: result.placementProgress }); setNotice("Your placement preparation progress is saved.");
      } catch (err) { setFormError(err.message); }
    }
    return <div className="page-content platform-page"><Heading eyebrow="FROM CAMPUS TO YOUR NEXT OPPORTUNITY" title={<>Your career corner, <em>ready when you are.</em></>} subtitle="Explore internships, practice interviews, and prepare your next application." />
      {error && <FormNotice error={error} />}
      {user.role === "student" && <StudentPlacementOpportunities courses={courses} />}
      {canPost && <form className="panel platform-form" onSubmit={addJob}><div className="panel-heading"><div><span className="eyebrow">PLACEMENT OFFICER WORKSPACE</span><h3>Share an opportunity</h3></div><BriefcaseBusiness size={19} /></div><div className="platform-form-grid">
        <label>Role title<input maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label>Organization<input maxLength="120" value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })} required /></label><label>Location<input maxLength="120" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} required /></label>
        <label>Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Internship</option><option>Entry level</option><option>Full time</option></select></label><label>HTTPS application link<input type="url" value={form.applyUrl} onChange={(event) => setForm({ ...form, applyUrl: event.target.value })} required /></label>
      </div><label>Description<textarea rows="3" maxLength="1000" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></label><FormNotice error={formError} notice={notice} /><button className="button button-primary">Post opportunity <Plus size={14} /></button></form>}
      {user.role === "student" && <section className="panel placement-progress-editor"><span className="eyebrow">YOUR PLACEMENT PREPARATION</span><label htmlFor="placement-progress">Progress: {progress}%</label><input id="placement-progress" type="range" min="0" max="100" step="5" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /><button className="button button-outline button-small" onClick={saveProgress}>Save progress <Check size={13} /></button>{notice && <p className="form-success">{notice}</p>}{formError && <FormNotice error={formError} />}</section>}
      <div className="career-layout"><section className="career-jobs"><div className="panel-heading"><div><span className="eyebrow">CURATED STARTING POINTS</span><h3>Jobs & internships</h3></div><BriefcaseBusiness size={18} /></div>
        {loading ? <section className="panel">Loading opportunities…</section> : data.jobs.map((job) => <article className="panel career-job-card" key={job.id}><div className="career-job-top"><span className="course-category">{job.type} · {job.location}</span><BriefcaseBusiness size={18} /></div><h3>{job.title}</h3><strong>{job.organization}</strong><p>{job.description}</p><div className="career-skills">{job.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><a className="button button-primary" href={job.applyUrl} target="_blank" rel="noreferrer">Explore application <ArrowRight size={14} /></a></article>)}
      </section><section className="panel interview-panel"><div className="panel-heading"><div><span className="eyebrow">PRACTICE OUT LOUD</span><h3>Mock interview prompts</h3></div><Sparkles size={19} /></div>
        {data.mockQuestions.map((question, index) => <details className="interview-question" key={question.prompt}><summary><span>{String(index + 1).padStart(2, "0")}</span>{question.category}</summary><p>{question.prompt}</p></details>)}
        <a className="career-resource-link" href="https://www.linkedin.com/learning/topics/resume-writing" target="_blank" rel="noreferrer"><FileText size={16} /> Resume preparation resources <ArrowRight size={14} /></a>
      </section></div>
      <section className="panel career-resources"><div className="panel-heading"><div><span className="eyebrow">PRACTICE & PREPARE</span><h3>Career resources</h3></div></div><div className="career-resource-grid"><a href="https://developer.mozilla.org/en-US/docs/Learn" target="_blank" rel="noreferrer"><BookOpen size={16} /> Portfolio project ideas <ArrowRight size={13} /></a><a href="https://www.hackerrank.com/domains/tutorials/10-days-of-javascript" target="_blank" rel="noreferrer"><Sparkles size={16} /> Coding practice <ArrowRight size={13} /></a></div></section>
    </div>;
  }
