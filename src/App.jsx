import { useEffect, useState } from "react";
import {
  Activity, ArrowRight, ArrowUpRight, Award, BarChart3, Bell, BookOpen, Bot, BriefcaseBusiness, Building2, CalendarDays, Camera, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleHelp, CircleUserRound, Clock3, FileCheck2, GraduationCap, LayoutDashboard,
  FileText, LogOut, Medal, Menu, MessageCircle, MoreHorizontal, Plus, Route, Search, Send, ShieldCheck, Sparkles, Target, Trash2, Upload, Download,
  Users, X, QrCode
} from "lucide-react";
import { api } from "./api.js";
import {
  AdminApiManagementPage, AdminAuditPage, AdminCoursesPage, AdminPermissionsPage, AdminSettingsPage, AdminUsersPage,
  AnalyticsPage, AssignmentsPage, AssistantPage, BatchesPage, CareerPage, EventsPage, PlacementOfficerPage,
  CommunityPage, GamificationPage, LearningHub, LearningPathPage, NotificationsPage, TrainerCoursesPage, TrainerReportsPage,
  ReportsPage, TimetablePage
} from "./Platform.jsx";
import QrScanner from "./QrScanner.jsx";
import { StudentPortfolio, StudentRecommendations } from "./StudentFeatures.jsx";

const roleNames = { student: "Student", trainer: "Trainer", coordinator: "Coordinator", placement_officer: "Placement Officer", administrator: "Administrator" };
const navItems = [
  ["overview", "Dashboard", LayoutDashboard],
  ["courses", "Courses & learning", BookOpen],
  ["tasks", "Tasks & feedback", FileCheck2],
  ["assignments", "Assignments", FileCheck2],
  ["attendance", "Attendance", CalendarDays],
  ["analytics", "Progress analytics", BarChart3],
  ["timetable", "Timetable", CalendarDays],
  ["events", "Campus events", CalendarDays],
  ["batches", "Batch allocation", Users],
  ["learningPath", "My learning path", Route],
  ["assistant", "AI campus assistant", Bot],
  ["community", "Campus community", Users],
  ["gamification", "Points & badges", Award],
  ["career", "Career & placements", BriefcaseBusiness],
  ["notifications", "Notifications", Bell],
  ["profile", "My profile", CircleUserRound],
  ["announcements", "Announcements", Bell],
  ["support", "Help & support", CircleHelp]
];
const rolePages = {
  overview: ["student", "trainer", "coordinator", "placement_officer", "administrator"],
  courses: ["student", "trainer", "coordinator", "placement_officer", "administrator"],
  tasks: ["student", "trainer", "coordinator", "administrator"],
  assignments: ["student", "trainer", "coordinator", "administrator"],
  attendance: ["student", "trainer", "coordinator", "administrator"],
  analytics: ["student", "trainer", "coordinator", "administrator"],
  timetable: ["student", "trainer", "coordinator", "administrator"],
  events: ["student", "trainer", "coordinator", "placement_officer", "administrator"],
  batches: ["trainer", "coordinator", "administrator"],
  learningPath: ["student"],
  assistant: ["student", "trainer", "coordinator", "placement_officer", "administrator"],
  community: ["student", "trainer", "coordinator", "placement_officer", "administrator"],
  gamification: ["student"],
  career: ["student", "placement_officer", "administrator"],
  notifications: ["student", "trainer", "coordinator", "placement_officer", "administrator"],
  profile: ["student", "trainer", "coordinator", "placement_officer", "administrator"],
  announcements: ["student", "trainer", "coordinator", "placement_officer", "administrator"],
  support: ["student", "trainer", "coordinator", "placement_officer", "administrator"]
};
const slides = [
  ["01 / THE OPPORTUNITY", "A calmer home for campus life.", "One thoughtful place to learn, keep moving, and feel part of the community.", "Everything important, finally in one place.", Sparkles],
  ["02 / WHO IT'S FOR", "The right view for every role.", "Learners build momentum. Trainers give useful feedback. Coordinators keep the campus in sync. Administrators keep the experience safe.", "One hub · Four perspectives", Users],
  ["03 / THE EXPERIENCE", "Learning, without the busywork.", "A gentle dashboard makes the next steps clear: what's due, where to be, and what changed.", "Dashboard · Courses · Tasks · Attendance · Campus", LayoutDashboard],
  ["04 / A LEARNER'S JOURNEY", "From first hello to real progress.", "Sign in → find your next session → submit your work → hear back from your trainer → see progress build.", "Clear steps. Helpful feedback. Visible growth.", ArrowRight],
  ["05 / PEOPLE & PLACE", "Campus feels closer.", "Useful announcements, real support, and campus services sit beside learning — never buried behind another tab.", "Community belongs in the learning journey.", MessageCircle],
  ["06 / BUILT WITH CARE", "Private by design. Usable by everyone.", "Role-based access, private learner records, validated forms, keyboard-friendly controls, and layouts for smaller screens.", "Protect people. Make the next step obvious.", ShieldCheck],
  ["07 / WHAT'S NEXT", "A focused prototype, ready to grow.", "This working model uses invented sample data. Real integrations, identity, messaging, and certificates belong in a future production phase.", "Start small. Learn from learners. Grow safely.", GraduationCap]
];

export function Avatar({ user, small = false }) {
  const initials = user?.initials || user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2) || "ZH";
  return <span className={`avatar avatar-${user?.color || "lilac"} ${small ? "avatar-small" : ""}`}>{user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}</span>;
}

function Brand({ featured = false }) {
  return <div className={`brand ${featured ? "brand-featured" : ""}`}>{featured ? <img className="brand-mark brand-image" src="/campus-hub-brand.jpe" alt="Zyngram Campus Hub logo" /> : <span className="brand-mark" role="img" aria-label="Zyngram logo" />}<span className="brand-copy">zyngram<span>campus hub</span></span></div>;
}

const loginRoles = [
  { id: "student", title: "Student", detail: "Student login", email: "student@zyngram.demo", initials: "SC", color: "lilac" },
  { id: "trainer", title: "Trainer", detail: "Learning mentor", email: "trainer@zyngram.com", initials: "TR", color: "peach" },
  { id: "coordinator", title: "Campus Coordinator", detail: "Campus operations", email: "coordinator@zyngram.com", initials: "CC", color: "mint" },
  { id: "administrator", title: "Administrator", detail: "Hub management", email: "admin@zyngram.com", initials: "AD", color: "blue" },
  { id: "placement_officer", title: "Placement Officer", detail: "Careers & placements", email: "placement@zyngram.com", initials: "AR", color: "mint" }
];

function Login({ onLogin, onRegister, busy, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createdAccount, setCreatedAccount] = useState(null);
  const [selectedInfo, setSelectedInfo] = useState("purpose");
  function chooseRole(account) {
    setSelectedRole(account);
    setEmail(account.id === "student" ? "" : account.email);
    setPassword("");
  }
  function backToRoles() {
    setSelectedRole(null);
    setRegistering(false);
    setCreatedAccount(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  }
  async function createStudentAccount(event) {
    event.preventDefault();
    const account = await onRegister(name, password, confirmPassword);
    if (account) {
      setCreatedAccount(account);
      setPassword("");
      setConfirmPassword("");
    }
  }
  function continueToStudentSignIn() {
    setRegistering(false);
    setCreatedAccount(null);
    setSelectedRole(loginRoles[0]);
    setEmail(createdAccount?.email || "");
    setPassword("");
  }
  function openStudentSignIn() {
    setRegistering(false);
    setCreatedAccount(null);
    setSelectedRole(loginRoles[0]);
    setEmail("");
    setPassword("");
  }
  return <main className="login-page">
    <section className="login-art"><Brand featured /><div className="login-art-copy"><span className="eyebrow light-eyebrow"><i className="live-dot" /> YOUR CAMPUS, IN GOOD COMPANY</span><h1>A little more<br />room to <em>grow.</em></h1><p>Learning, people, and all the little things that make campus feel like yours.</p></div><span className="art-sun" /><span className="art-orbit art-orbit-one" /><span className="art-orbit art-orbit-two" /><span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✦</span></section>
    <section className="login-form-side" id="hub-login"><div className={`login-form-wrap ${selectedRole ? "role-login-wrap" : "role-select-wrap"}`}><div className="mobile-brand"><Brand featured /></div>
      {!selectedRole && registering ? <>
        <button type="button" className="role-back-button" onClick={backToRoles}><ChevronLeft size={15} /> Back to sign in</button>
        {!createdAccount ? <>
          <span className="eyebrow">YOUR LEARNING SPACE</span><h2>Create your account<span className="heading-dot">.</span></h2><p className="muted">Create your account with your name and a password. We will generate your own unique ZIN ID.</p>
          <form onSubmit={createStudentAccount}>
            <label htmlFor="register-name">Full name</label><input id="register-name" autoComplete="name" maxLength="80" value={name} onChange={(event) => setName(event.target.value)} required />
            <label htmlFor="register-password">Create password</label><input id="register-password" type="password" autoComplete="new-password" minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} required />
            <label htmlFor="register-confirm">Confirm password</label><input id="register-confirm" type="password" autoComplete="new-password" minLength="8" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary button-full" type="submit" disabled={busy}>{busy ? "Creating your ZIN ID…" : "Create student account"}<ArrowRight size={17} /></button>
          </form>
          <button type="button" className="register-link" onClick={openStudentSignIn}>Already have a ZIN ID? Sign in <ArrowRight size={14} /></button>
          <div className="demo-note"><ShieldCheck size={16} /><span>Your ID starts and ends with letters from your first name, plus unique numbers. Keep your password private.</span></div>
        </> : <div className="created-account-card" role="status">
          <span className="eyebrow">ACCOUNT CREATED</span><h2>Your student login is ready<span className="heading-dot">.</span></h2>
          <p className="muted">Your ZIN ID uses letters from your name. Sign in with your ZIN ID or Zyngram email and the password you created.</p>
          <div><small>ZIN ID</small><strong>{createdAccount.zinId}</strong></div>
          <div><small>ZYNGRAM LOGIN EMAIL</small><strong>{createdAccount.email}</strong></div>
          <div><small>PASSWORD</small><strong>The password you created during registration</strong></div>
          <button className="button button-primary button-full" type="button" onClick={continueToStudentSignIn}>Continue to student sign in<ArrowRight size={17} /></button>
        </div>}
      </> : !selectedRole ? <>
        <h2 className="login-welcome">Welcome to your hub<span className="heading-dot">.</span></h2>
        <div className="role-picker" aria-label="Choose your account type">{loginRoles.map((account) => <button key={account.id} type="button" className="role-option" onClick={() => chooseRole(account)}><Avatar user={account} small /><span className="role-option-copy"><strong>{account.title}</strong><small>{account.detail}</small><small className="role-option-action">Open workspace</small></span></button>)}</div>
        <button type="button" className="register-link" onClick={() => { setRegistering(true); setCreatedAccount(null); setEmail(""); setPassword(""); }}>New to Zyngram? Create a student account</button>
      </> : <>
        <button type="button" className="role-back-button" onClick={backToRoles}><ChevronLeft size={15} /> All account types</button>
        <div className="role-login-heading"><Avatar user={selectedRole} /><div><span className="eyebrow">YOUR LEARNING SPACE</span><h2>{selectedRole.title} sign in<span className="heading-dot">.</span></h2></div></div>
        <p className="muted">Enter your {selectedRole.title} account details to continue.</p>
        <form onSubmit={(event) => { event.preventDefault(); const signInEmail = selectedRole.id === "student" && /^[A-Z]{2}\d{12}[A-Z]{2}$/i.test(email.trim()) ? `${email.trim()}@zyngram.com` : email.trim(); onLogin(signInEmail, password, selectedRole.id); }}><label htmlFor="login-email">{selectedRole.id === "student" ? "Your ZIN ID or @zyngram.com email" : "Email address"}</label><input id="login-email" type={selectedRole.id === "student" ? "text" : "email"} autoComplete="username" placeholder={selectedRole.id === "student" ? "Your name-based ZIN ID" : ""} value={email} onChange={(event) => setEmail(event.target.value)} required /><label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary button-full" type="submit" disabled={busy}>{busy ? "Opening your hub…" : `Sign in as ${selectedRole.title}`}<ArrowRight size={17} /></button></form>
        {selectedRole.id === "student" && <button type="button" className="register-link" onClick={() => { setSelectedRole(null); setRegistering(true); setCreatedAccount(null); setEmail(""); setPassword(""); }}>New student? Create a ZIN ID <ArrowRight size={14} /></button>}
        {selectedRole.id === "administrator" && <p className="login-access-note">Administrator access is assigned to specific accounts by an existing administrator. New accounts start as trainees.</p>}
        {selectedRole.id !== "student" && <div className="demo-note"><ShieldCheck size={16} /><span>Use the initial password provided by your campus administrator. You will create a personal password after your first sign-in.</span></div>}
      </>}
      <p className="login-legal">ZYNGRAM CAMPUS HUB <span>·</span> A LEARNING DESIGN PROTOTYPE</p>
    </div></section>
    <section className="public-hub" aria-label="About Zyngram Campus Hub">
      <div className="public-hub-inner">
        <div className="public-hub-heading"><span className="eyebrow">A CAMPUS BUILT AROUND GROWTH</span><h2>More than a place to learn.<br /><em>A place to find your next step.</em></h2><p>Zyngram Campus Hub brings learning, campus activities, and career preparation together in one supportive student experience.</p></div>
        <nav className="public-hub-nav" aria-label="Explore Zyngram Campus Hub">
          <button type="button" aria-controls="hub-info-panel" aria-pressed={selectedInfo === "purpose"} onClick={() => setSelectedInfo("purpose")}>Our purpose</button>
          <button type="button" aria-controls="hub-info-panel" aria-pressed={selectedInfo === "activities"} onClick={() => setSelectedInfo("activities")}>Activities</button>
          <button type="button" aria-controls="hub-info-panel" aria-pressed={selectedInfo === "placements"} onClick={() => setSelectedInfo("placements")}>Placements</button>
          <button type="button" aria-controls="hub-info-panel" aria-pressed={selectedInfo === "benefits"} onClick={() => setSelectedInfo("benefits")}>Student benefits</button>
        </nav>
        <article className={`public-hub-card public-hub-info-panel public-hub-${selectedInfo}`} id="hub-info-panel" role="region" aria-label="Selected campus information" aria-live="polite">
          {selectedInfo === "purpose" && <>
            <span className="public-hub-icon"><Target size={20} /></span><span className="eyebrow">VISION & MISSION</span>
            <h3>Learning with direction. Growth with purpose.</h3>
            <p><strong>Our vision</strong> is to make practical, guided learning and career growth more accessible to every student.</p>
            <p><strong>Our mission</strong> is to connect structured courses, hands-on practice, mentoring, and opportunities in one clear campus journey.</p>
          </>}
          {selectedInfo === "activities" && <>
            <span className="public-hub-icon public-hub-icon-peach"><Building2 size={20} /></span><span className="eyebrow">ZYNGRAM & CAMPUS ACTIVITIES</span>
            <h3>Learn by taking part.</h3>
            <p>Explore learning events, mentor-led sessions, practical projects, peer study groups, and showcases that turn ideas into experience.</p>
            <div className="public-hub-tags"><span>Workshops</span><span>Projects</span><span>Events</span><span>Peer learning</span></div>
          </>}
          {selectedInfo === "placements" && <>
            <span className="public-hub-icon public-hub-icon-blue"><BriefcaseBusiness size={20} /></span><span className="eyebrow">CAREER & PLACEMENT SUPPORT</span>
            <h3>Build skills. Show what you can do.</h3>
            <p>Prepare with skill pathways, portfolio-ready projects, resume support, interview practice, and placement progress tools.</p>
            <a className="public-hub-text-link" href="#hub-login">Explore career support</a>
          </>}
          {selectedInfo === "benefits" && <>
            <span className="public-hub-icon public-hub-icon-lilac"><GraduationCap size={20} /></span><span className="eyebrow">MADE TO HELP STUDENTS</span>
            <h3>Your next steps, all in one hub.</h3>
            <p>See what to learn next, follow course progress, complete assignments, get feedback, join campus activities, and celebrate your achievements.</p>
            <a className="public-hub-text-link" href="#hub-login">Find your learning space</a>
          </>}
        </article>
        <div className="public-hub-footer"><Brand /></div>
      </div>
    </section>
  </main>;
}

function PasswordSetup({ onSubmit, onSignOut, busy, error }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  return <main className="login-page password-setup-page">
    <section className="login-form-side"><div className="login-form-wrap role-login-wrap password-setup-wrap">
      <div className="mobile-brand"><Brand /></div>
      <span className="eyebrow">ONE-TIME ACCOUNT SETUP</span>
      <h2>Create your password<span className="heading-dot">.</span></h2>
      <p className="muted">Choose a private password for your Zyngram staff account. You will use it for future sign-ins.</p>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(password, confirmPassword); }}>
        <label htmlFor="staff-new-password">New password</label>
        <input id="staff-new-password" type="password" autoComplete="new-password" minLength="8" maxLength="128" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <label htmlFor="staff-confirm-password">Confirm new password</label>
        <input id="staff-confirm-password" type="password" autoComplete="new-password" minLength="8" maxLength="128" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        <p className="password-requirements">Use 8–128 characters with at least one letter and one number.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary button-full" type="submit" disabled={busy}>{busy ? "Saving your password…" : "Save password and continue"}<ArrowRight size={17} /></button>
      </form>
      <button className="register-link" type="button" onClick={onSignOut}>Sign out</button>
    </div></section>
  </main>;
}

function Sidebar({ page, setPage, user, onLogout, mobileOpen, closeMobile }) {
  const trainerNavItems = [
    ["overview", "Dashboard", LayoutDashboard],
    ["courses", "My courses", BookOpen],
    ["batches", "Courses & batches", Users],
    ["attendance", "Attendance", CalendarDays],
    ["assignments", "Assignments & evaluation", FileCheck2],
    ["timetable", "Timetable", CalendarDays],
    ["analytics", "Student progress", BarChart3],
    ["announcements", "Announcements", Bell],
    ["community", "Doubts & Q&A", MessageCircle],
    ["support", "Help & support", CircleHelp],
    ["profile", "My profile", CircleUserRound]
  ];
  const coordinatorNavItems = [
    ["overview", "Dashboard", LayoutDashboard],
    ["students", "Student management", GraduationCap],
    ["trainers", "Trainer management", BriefcaseBusiness],
    ["batches", "Batch management", Users],
    ["timetable", "Timetable & scheduling", CalendarDays],
    ["attendance", "Attendance monitoring", Check],
    ["assignments", "Tasks & assignments", FileCheck2],
    ["events", "Campus events", CalendarDays],
    ["announcements", "Announcements", Bell],
    ["requests", "Requests & issues", CircleHelp],
    ["reports", "Reports & analytics", BarChart3],
    ["notifications", "Notifications", Bell],
    ["profile", "My profile", CircleUserRound],
    ["support", "Help & support", CircleHelp]
  ];
  const administratorNavItems = [
    ["overview", "Dashboard", LayoutDashboard],
    ["adminUsers", "User management", Users],
    ["adminPermissions", "Roles & permissions", ShieldCheck],
    ["adminCourses", "Course management", BookOpen],
    ["batches", "Batches & enrollment", Users],
    ["trainers", "Trainer management", BriefcaseBusiness],
    ["coordinators", "Coordinator management", Building2],
    ["timetable", "Timetable & calendar", CalendarDays],
    ["attendance", "Attendance & reports", Check],
    ["events", "Campus events", CalendarDays],
    ["announcements", "Announcements", Bell],
    ["support", "Requests & support", CircleHelp],
    ["reports", "Campus reports", BarChart3],
    ["adminAudit", "Audit logs", Clock3],
    ["apiManagement", "API management", ShieldCheck],
    ["adminSettings", "System settings", ShieldCheck],
    ["profile", "My profile", CircleUserRound]
  ];
  const placementNavItems = [
    ["overview", "Dashboard", LayoutDashboard],
    ["placementStudents", "Student profiles", GraduationCap],
    ["placementCompanies", "Company management", Building2],
    ["placementJobs", "Jobs & internships", BriefcaseBusiness],
    ["placementDrives", "Placement drives", CalendarDays],
    ["placementApplications", "Applications & shortlisting", FileCheck2],
    ["placementInterviews", "Interview scheduling", Clock3],
    ["placementOffers", "Selection & offers", Award],
    ["placementResources", "Resume & career prep", FileText],
    ["announcements", "Announcements", Bell],
    ["placementReports", "Placement reports", BarChart3],
    ["notifications", "Notifications", Bell],
    ["profile", "My profile", CircleUserRound],
    ["support", "Help & support", CircleHelp]
  ];
  const visibleItems = user.role === "trainer"
    ? trainerNavItems
    : user.role === "coordinator"
      ? coordinatorNavItems
    : user.role === "administrator"
      ? administratorNavItems
    : user.role === "placement_officer"
      ? placementNavItems
    : navItems.filter(([id]) => rolePages[id]?.includes(user.role));
  if (user.role === "administrator") visibleItems.push(["modules", "Manage modules", BookOpen]);
  return <><button className={`mobile-scrim ${mobileOpen ? "scrim-open" : ""}`} aria-label="Close navigation" onClick={closeMobile} /><aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}><Brand />
    <div className="workspace-switch"><span className="workspace-icon">Z</span><span><strong>Zyngram Campus</strong><small>Learning space</small></span><ChevronDown size={15} /></div>
    <div className="nav-caption">WORKSPACE</div><nav className="nav-list" aria-label="Main navigation">{visibleItems.map(([id, label, Icon]) => <button key={id} className={`nav-link ${page === id ? "active" : ""}`} onClick={() => { setPage(id); closeMobile(); }}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{id === "tasks" && user.role === "student" && <span className="nav-count">{user.pendingAssignments || ""}</span>}</button>)}</nav>
    <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><MessageCircle size={17} /></div><strong>Need a hand?</strong><p>We're just around the corner.</p><button onClick={() => { setPage("support"); closeMobile(); }}>Visit help desk <ArrowRight size={13} /></button></div><div className="sidebar-user"><Avatar user={user} /><span className="sidebar-user-copy"><strong>{user.name}</strong><small>{roleNames[user.role]}</small></span><button className="icon-button logout-button" title="Sign out" onClick={onLogout}><LogOut size={16} /></button></div></div>
  </aside></>;
}

function Header({ title, user, onMenu, onProfile, onNotifications }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  useEffect(() => {
    const capturePrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const installed = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }
  const formatted = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  return <header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={onMenu}><Menu size={21} /></button><div className="breadcrumb"><span>Campus Hub</span><span className="breadcrumb-slash">/</span><strong>{title}</strong></div><div className="topbar-actions"><span className="today-label">{formatted}</span>{installPrompt && <button className="button button-outline button-small install-app-button" onClick={installApp}><Download size={14} /> Install app</button>}<button className="icon-button notification-button" title="Notifications" onClick={onNotifications}><Bell size={18} /><i /></button><span className="topbar-divider" /><button className="profile-button" onClick={onProfile}><Avatar user={user} small /><span><strong>{user.name}</strong><small>{roleNames[user.role]}</small></span><ChevronDown size={14} /></button></div></header>;
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
function Pill({ children, tone = "default" }) { return <span className={`pill pill-${tone}`}>{children}</span>; }
function Empty({ icon: Icon, title, text }) { return <div className="empty-state"><span><Icon size={22} /></span><strong>{title}</strong><p>{text}</p></div>; }
function Notice({ error, success }) { return <>{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}</>; }

function Dashboard({ data, user, setPage }) {
  const learner = user.role === "student";
  const due = data.nextDeadline || data.tasks.find((task) => task.status !== "submitted");
  const weeklyActivity = data.weeklyActivity || [];
  const maxActivity = Math.max(1, ...weeklyActivity.map((item) => item.count));
  return <div className="page-content">
    <PageHeading eyebrow="WELCOME TO YOUR CAMPUS HUB" title={<>Welcome, {user.name.split(" ")[0]}<span className="heading-dot">!</span></>} subtitle="“Every small step brings you closer to something great.”" action={<button className="button button-outline" onClick={() => setPage("courses")}><CalendarDays size={16} /> This week <ChevronDown size={14} /></button>} />
    <section className="welcome-banner"><div className="banner-copy"><span className="eyebrow light-eyebrow">A NOTE FOR YOUR WEEK <span className="banner-spark">✳</span></span><h2>{learner ? <>You're closer than<br />you think.</> : <>Small steps make<br />big momentum.</>}</h2><p>{learner ? "One task, one question, one brave idea. You've got this." : "A little encouragement goes a long way. Your learners are making moves."}</p><button className="button button-light" onClick={() => setPage("tasks")}>{learner ? "See my next step" : "See learner progress"}<ArrowRight size={16} /></button></div><div className="banner-illustration" aria-hidden="true"><span className="banner-orbit orbit-a" /><span className="banner-orbit orbit-b" /><span className="banner-planet">✳</span><span className="banner-star star-a">✦</span><span className="banner-star star-b">✧</span><span className="banner-satellite">◌</span></div><span className="banner-index">A LITTLE AT A TIME · 01</span></section>
    <div className="stats-grid">
      <article className="stat-card"><div className="stat-top"><span className="stat-icon lilac-icon"><BookOpen size={17} /></span><span className="stat-trend neutral">{learner ? "ENROLLED" : "CAMPUS"}</span></div><strong>{learner ? data.courses.length.toString().padStart(2, "0") : data.counts.learners.toString().padStart(2, "0")}</strong><span>{learner ? "Active courses" : "Active learners"}</span><small>{learner ? "Across your learning plan" : "Across all active batches"}</small></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-icon orange-icon"><Clock3 size={17} /></span><span className="stat-trend neutral">THIS WEEK</span></div><strong>{(data.pendingAssignments ?? data.tasks.filter((task) => task.status !== "submitted").length).toString().padStart(2, "0")}</strong><span>{learner ? "Pending assignments" : "Sessions to review"}</span><small>{due ? `Next up · ${new Date(`${due.due}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })}` : "You're all caught up"}</small></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-icon green-icon"><Activity size={17} /></span><span className="stat-trend neutral">RECORDED</span></div><strong>{data.attendancePercent}<small className="percent">%</small></strong><span>Attendance so far</span><small>Based on recorded sessions</small></article>
      <article className="stat-card"><div className="stat-top"><span className="stat-icon blue-icon"><Sparkles size={17} /></span><span className="stat-trend neutral">{learner ? `${data.learningPoints || 0} POINTS` : "REVIEWS"}</span></div><strong>{learner ? `${data.learningProgress || 0}%` : data.counts.pendingReviews.toString().padStart(2, "0")}</strong><span>{learner ? "Learning progress" : "Reviews to share"}</span><small>{learner ? `${(data.badges || []).length} badges earned` : "A little feedback goes far"}</small></article>
    </div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">MADE FOR YOUR NEXT CHAPTER</span><h3>{learner ? "Your learning path" : "Your campus courses"}</h3></div><button className="link-button" onClick={() => setPage("courses")}>All courses <ArrowRight size={15} /></button></div><div className="course-list">{data.courses.slice(0, 3).map((course) => <article className="course-row" key={course.id}><span className={`course-symbol symbol-${course.color}`}>{course.icon}</span><div className="course-row-info"><span className="course-category">{course.category}</span><strong>{course.title}</strong><small>{course.trainer} <i>·</i> {course.schedule}</small></div><div className="course-progress"><div className="progress-label"><span>{course.progress}%</span><small>done</small></div><div className="progress-track"><span style={{ width: `${course.progress}%` }} /></div></div><button className="icon-button row-arrow" onClick={() => setPage("courses")} aria-label={`Open ${course.title}`}><ArrowRight size={16} /></button></article>)}</div></section>
      <section className="panel progress-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR LITTLE WINS ADD UP</span><h3>Learning rhythm</h3></div></div><div className="rhythm-summary"><div><strong>{data.weeklyActiveDays || 0}<span> days</span></strong><small>with recorded activity this week</small></div><div className="rhythm-legend"><i /> Lessons + attendance</div></div><div className="chart-bars" role="img" aria-label="Recorded lesson completions and attendance over the last seven days">{weeklyActivity.map((item, index) => <div className="bar-column" key={`${item.day}-${index}`}><span className={`chart-bar ${index === weeklyActivity.length - 1 ? "chart-bar-current" : ""}`} style={{ height: `${item.count ? Math.max(8, item.count / maxActivity * 100) : 4}%` }} /><small>{item.day}</small></div>)}</div><div className="progress-foot"><span><i /> Activity from your recorded learning.</span></div></section>
    </div>
    <div className="dashboard-grid lower-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">ONE THING AT A TIME</span><h3>Coming up next</h3></div><button className="link-button" onClick={() => setPage("tasks")}>See all <ArrowRight size={15} /></button></div>{data.tasks.slice(0, 2).map((task) => <button className="task-teaser" key={task.id} onClick={() => setPage("tasks")}><span className={`task-check ${task.status === "submitted" ? "task-done" : ""}`}>{task.status === "submitted" && <Check size={13} />}</span><span className="task-teaser-copy"><strong>{task.title}</strong><small>{task.course}</small></span><span className="task-due">{task.status === "submitted" ? "Submitted" : `Due ${new Date(`${task.due}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })}`}</span><ChevronRight size={15} /></button>)}</section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">A NOTE FROM YOUR COMMUNITY</span><h3>Campus bulletin</h3></div><button className="link-button" onClick={() => setPage("announcements")}>All notes <ArrowRight size={15} /></button></div>{data.announcements.slice(0, 2).map((note) => <button className="announcement-teaser" key={note.id} onClick={() => setPage("announcements")}><span className={`announcement-mark mark-${note.color}`}>{note.tag === "CAMPUS" ? "✳" : "✦"}</span><span><strong>{note.title}</strong><small>{new Date(`${note.date}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })} · {note.author}</small></span></button>)}</section></div>
    <div className="dashboard-grid dashboard-support-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">YOUR NEXT CLASS</span><h3>Upcoming timetable</h3></div><button className="link-button" onClick={() => setPage("timetable")}>Full week <ArrowRight size={14} /></button></div>{(data.upcomingClasses || []).slice(0, 3).map((item) => <button className="upcoming-class-row" key={item.id} onClick={() => setPage("timetable")}><span className="upcoming-class-day">{new Date(item.date).toLocaleDateString("en", { weekday: "short" })}</span><span><strong>{item.title}</strong><small>{item.course} · {new Date(item.date).toLocaleDateString("en", { month: "short", day: "numeric" })} · {item.startTime} · {item.room}</small></span><ChevronRight size={14} /></button>)}{!data.upcomingClasses?.length && <p className="empty-inline">No classes scheduled yet.</p>}</section><section className="panel dashboard-shortcuts"><span className="eyebrow">YOUR CAMPUS, ONE STEP AWAY</span><h3>{learner && data.nextAction ? data.nextAction.title : "Keep your momentum"}</h3><p>{learner && data.nextAction ? data.nextAction.detail : learner ? "Choose a small next step and build a steady learning rhythm." : "A little coordination today makes a smoother learner journey."}</p><div className="dashboard-shortcut-grid">{learner && <button onClick={() => setPage(data.nextAction?.target || "learningPath")}><GraduationCap size={16} /> Your next action</button>}{learner && <button onClick={() => setPage("learningPath")}><GraduationCap size={16} /> Learning path</button>}<button onClick={() => setPage("assistant")}><Sparkles size={16} /> Ask assistant</button><button onClick={() => setPage("career")}><BookOpen size={16} /> Career prep</button><button onClick={() => setPage("analytics")}><Activity size={16} /> Progress report</button></div></section></div>
    {learner && <div className="dashboard-grid"><StudentRecommendations setPage={setPage} /></div>}
    <footer className="page-footer"><span>MADE WITH A LITTLE EXTRA CARE <b>✳</b></span><span>ZYNGRAM CAMPUS HUB <i>·</i> 2026</span></footer>
  </div>;
}

function TrainerDashboard({ user, setPage }) {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/trainer/overview").then(setOverview).catch((err) => setError(err.message));
  }, []);
  if (error) return <div className="page-content"><PageHeading eyebrow="TRAINER WORKSPACE" title={<>Your campus, <em>in your hands.</em></>} /><div className="global-error" role="alert">{error}</div></div>;
  if (!overview) return <div className="page-content"><PageHeading eyebrow="TRAINER WORKSPACE" title={<>Your campus, <em>in your hands.</em></>} /><section className="panel">Loading your trainer dashboard…</section></div>;
  const stats = [
    ["Students", overview.students.length, Users],
    ["My courses", overview.courses.length, BookOpen],
    ["My batches", overview.batches.length, Activity],
    ["Today's classes", overview.todayClasses.length, CalendarDays],
    ["To evaluate", overview.pendingEvaluations, FileCheck2],
    ["Attendance", `${overview.attendancePercent}%`, Clock3]
  ];
  return <div className="page-content trainer-dashboard">
    <PageHeading eyebrow="TRAINER WORKSPACE" title={<>Welcome back, {user.name.split(" ")[0]}<span className="heading-dot">.</span></>} subtitle="Your teaching day, courses, learners, and next actions—all in one place." action={<button className="button button-outline" onClick={() => setPage("profile")}>Trainer ID · {overview.trainerId}</button>} />
    <section className="trainer-welcome-panel"><div><span className="eyebrow light-eyebrow">YOUR TRAINING SPACE</span><h2>Teach with clarity.<br /><em>Help every learner grow.</em></h2><p>Check today's classes, respond to student work, and keep your courses moving.</p></div><div className="trainer-welcome-actions"><button className="button button-light" onClick={() => setPage("courses")}><Plus size={15} /> Add a course</button><button className="button button-outline" onClick={() => setPage("assignments")}>Review submissions <ArrowRight size={15} /></button></div></section>
    <div className="stats-grid trainer-stats">{stats.map(([label, value, Icon]) => <article className="stat-card" key={label}><div className="stat-top"><span className="stat-icon green-icon"><Icon size={17} /></span><span className="stat-trend neutral">TRAINER</span></div><strong>{value}</strong><span>{label}</span><small>{label === "Attendance" ? "Across your course sessions" : "Current assigned activity"}</small></article>)}</div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">YOUR TEACHING LOAD</span><h3>Assigned courses</h3></div><button className="link-button" onClick={() => setPage("courses")}>Manage courses <ArrowRight size={14} /></button></div>
        {overview.courses.length ? overview.courses.slice(0, 5).map((course) => <article className="course-row" key={course.id}><span className={`course-symbol symbol-${course.color || "green"}`}>{course.icon || "✳"}</span><div className="course-row-info"><span className="course-category">{course.category}</span><strong>{course.title}</strong><small>{course.enrolled?.length || 0} learners · {course.schedule}</small></div><button className="icon-button row-arrow" onClick={() => setPage("courses")} aria-label={`Manage ${course.title}`}><ArrowRight size={16} /></button></article>) : <p className="trainer-empty-note">No courses assigned yet. Create your first course to get started.</p>}
      </section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ON YOUR CALENDAR</span><h3>Today's classes</h3></div><button className="link-button" onClick={() => setPage("timetable")}>Full timetable <ArrowRight size={14} /></button></div>
        {overview.todayClasses.length ? overview.todayClasses.map((item) => <article className="upcoming-class-row" key={item.id}><span className="upcoming-class-day">{item.startTime}</span><span><strong>{item.title}</strong><small>{item.course} · {item.room}</small></span></article>) : <p className="trainer-empty-note">No classes are scheduled for today.</p>}
      </section>
    </div>
    <section className="panel trainer-progress-panel"><div className="panel-heading"><div><span className="eyebrow">LEARNER CHECK-IN</span><h3>Student progress & feedback</h3></div><button className="link-button" onClick={() => setPage("analytics")}>Open reports <ArrowRight size={14} /></button></div>
      <div className="table-wrap"><table><thead><tr><th>STUDENT</th><th>ASSIGNED COURSES</th><th>ATTENDANCE</th><th>WORK SUBMITTED</th><th>REVIEWED</th><th>AVERAGE MARKS</th></tr></thead><tbody>{overview.students.map((student) => <tr key={student.id}><td><strong>{student.name}</strong><small className="trainer-student-email">{student.email}</small>{student.skills && <small className="trainer-student-email">Skills: {student.skills}</small>}</td><td>{student.courses.join(", ") || "Not enrolled"}</td><td>{student.attendancePercent}%</td><td>{student.assignmentsSubmitted}</td><td>{student.assignmentsReviewed}</td><td>{student.marksAverage === null ? "—" : `${student.marksAverage}%`}</td></tr>)}</tbody></table>{!overview.students.length && <p className="trainer-empty-note">Students in your assigned courses will appear here.</p>}</div>
    </section>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">COHORT OVERVIEW</span><h3>Assigned batches</h3></div><button className="link-button" onClick={() => setPage("batches")}>View batches <ArrowRight size={14} /></button></div>{overview.batches.length ? overview.batches.map((batch) => <article className="trainer-batch-row" key={batch.id}><span><strong>{batch.name}</strong><small>{batch.course}</small></span><Pill>{batch.learnerCount} learners</Pill></article>) : <p className="trainer-empty-note">Your coordinator hasn't assigned a batch yet.</p>}</section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">KEEP EVERYONE IN THE LOOP</span><h3>Recent announcements</h3></div><button className="link-button" onClick={() => setPage("announcements")}>Post an update <ArrowRight size={14} /></button></div>{overview.announcements.length ? overview.announcements.map((note) => <article className="trainer-announcement-row" key={note.id}><strong>{note.title}</strong><p>{note.body}</p><small>{note.date} · {note.author}</small></article>) : <p className="trainer-empty-note">No recent updates yet.</p>}</section>
    </div>
  </div>;
}

function PlacementOfficerDashboard({ user, setPage }) {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/placement/officer/overview").then(setOverview).catch((err) => setError(err.message)); }, []);
  if (error) return <div className="page-content"><PageHeading eyebrow="PLACEMENT OFFICER" title={<>Career pathways, <em>in motion.</em></>} /><div className="global-error" role="alert">{error}</div></div>;
  if (!overview) return <div className="page-content"><PageHeading eyebrow="PLACEMENT OFFICER" title={<>Career pathways, <em>in motion.</em></>} /><section className="panel">Loading placement dashboard…</section></div>;
  const cards = [
    ["Registered students", overview.counts.students, GraduationCap, "placementStudents"],
    ["Eligible students", overview.counts.eligibleStudents, Check, "placementStudents"],
    ["Companies", overview.counts.companies, Building2, "placementCompanies"],
    ["Active opportunities", overview.counts.activeJobs, BriefcaseBusiness, "placementJobs"],
    ["Upcoming drives", overview.counts.upcomingDrives, CalendarDays, "placementDrives"],
    ["Scheduled interviews", overview.counts.scheduledInterviews, Clock3, "placementInterviews"],
    ["Students placed", overview.counts.placedStudents, Award, "placementOffers"],
    ["Offers awaiting response", overview.counts.pendingOffers, FileCheck2, "placementOffers"],
    ["Offers received", overview.counts.offersReceived, CircleCheck, "placementOffers"]
  ];
  return <div className="page-content placement-dashboard">
    <PageHeading eyebrow={`PLACEMENT OFFICER · ${overview.officerId}`} title={<>Welcome, {user.name.split(" ")[0]}<span className="heading-dot">.</span></>} subtitle="Connect student talent to real opportunities and keep each application moving with care." action={<button className="button button-outline" onClick={() => setPage("placementReports")}>Placement reports <ArrowRight size={14} /></button>} />
    <section className="trainer-welcome-panel placement-welcome-panel"><div><span className="eyebrow light-eyebrow">CAREERS START WITH A CONNECTION</span><h2>Open doors.<br /><em>Track every next step.</em></h2><p>Manage company relationships, candidate journeys, interviews, and verified offers in one workspace.</p></div><div className="trainer-welcome-actions"><button className="button button-light" onClick={() => setPage("placementJobs")}><Plus size={15} /> Post an opportunity</button><button className="button button-outline" onClick={() => setPage("placementStudents")}><Users size={15} /> Find candidates</button></div></section>
    <div className="admin-dashboard-stats">{cards.map(([label, value, Icon, target]) => <button className="panel admin-dashboard-stat" key={label} onClick={() => setPage(target)}><span className="stat-icon green-icon"><Icon size={17} /></span><strong>{value}</strong><span>{label}</span><small>Open workspace <ArrowRight size={12} /></small></button>)}</div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">CANDIDATE ACTIVITY</span><h3>Recent applications</h3></div><button className="link-button" onClick={() => setPage("placementApplications")}>Review all <ArrowRight size={14} /></button></div>{overview.recentApplications.length ? overview.recentApplications.map((application) => <article className="trainer-announcement-row" key={application.id}><strong>{application.student?.name || "Student"} · {application.title}</strong><p>{application.companyName} · {application.student?.studentId}</p><small>{application.status.replaceAll("_", " ")} · {new Date(application.createdAt).toLocaleDateString()}</small></article>) : <p className="trainer-empty-note">New student applications will appear here.</p>}</section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">UPCOMING HIRING EVENTS</span><h3>Placement drives</h3></div><button className="link-button" onClick={() => setPage("placementDrives")}>Manage drives <ArrowRight size={14} /></button></div>{overview.upcomingDrives.length ? overview.upcomingDrives.map((drive) => <article className="upcoming-class-row" key={drive.id}><span className="upcoming-class-day">{new Date(`${drive.driveDate}T12:00:00`).toLocaleDateString("en", { day: "numeric", month: "short" })}</span><span><strong>{drive.roleTitle}</strong><small>{drive.companyName} · {drive.venue}</small></span></article>) : <p className="trainer-empty-note">Publish a drive to make it visible to eligible students.</p>}</section></div>
  </div>;
}

function CoordinatorDashboard({ user, setPage }) {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/coordinator/overview").then(setOverview).catch((err) => setError(err.message)); }, []);
  if (error) return <div className="page-content"><PageHeading eyebrow="CAMPUS OPERATIONS" title={<>Your campus, <em>in sync.</em></>} /><div className="global-error" role="alert">{error}</div></div>;
  if (!overview) return <div className="page-content"><PageHeading eyebrow="CAMPUS OPERATIONS" title={<>Your campus, <em>in sync.</em></>} /><section className="panel">Loading coordinator dashboard…</section></div>;
  const stats = [
    ["Students", overview.counts.students, GraduationCap, "Across the campus"],
    ["Trainers", overview.counts.trainers, BriefcaseBusiness, "Teaching team"],
    ["Active batches", overview.counts.activeBatches, Users, "Current cohorts"],
    ["Today's classes", overview.counts.todayClasses, CalendarDays, "On today's schedule"],
    ["Pending requests", overview.counts.pendingRequests, CircleHelp, "Need coordinator review"],
    ["Attendance", `${overview.attendancePercent}%`, Activity, `${overview.missingAttendance.length} class records missing`]
  ];
  return <div className="page-content coordinator-dashboard">
    <PageHeading eyebrow="CAMPUS COORDINATOR" title={<>Welcome, {user.name.split(" ")[0]}<span className="heading-dot">.</span></>} subtitle="A campus-wide view of learners, teaching, schedules, attendance, and what needs your attention." action={<button className="button button-outline" onClick={() => setPage("reports")}>Open campus report <ArrowRight size={15} /></button>} />
    <section className="coordinator-welcome-panel"><div><span className="eyebrow light-eyebrow">CAMPUS, IN GOOD RHYTHM</span><h2>Keep every part<br /><em>moving together.</em></h2><p>See today's activity, follow up on requests, and help the whole campus stay on track.</p></div><div className="coordinator-shortcuts"><button className="button button-light" onClick={() => setPage("students")}><GraduationCap size={15} /> Find a student</button><button className="button button-outline" onClick={() => setPage("batches")}><Plus size={15} /> Manage batches</button></div></section>
    <div className="stats-grid coordinator-stats">{stats.map(([label, value, Icon, note]) => <article className="stat-card" key={label}><div className="stat-top"><span className="stat-icon green-icon"><Icon size={17} /></span><span className="stat-trend neutral">CAMPUS</span></div><strong>{value}</strong><span>{label}</span><small>{note}</small></article>)}</div>
    <div className="dashboard-grid coordinator-grid">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">TODAY'S RUN OF SHOW</span><h3>Scheduled classes</h3></div><button className="link-button" onClick={() => setPage("timetable")}>Manage timetable <ArrowRight size={14} /></button></div>
        {overview.todayClasses.length ? overview.todayClasses.map((item) => <article className="upcoming-class-row" key={item.id}><span className="upcoming-class-day">{item.startTime}</span><span><strong>{item.title}</strong><small>{item.course} · {item.trainer} · {item.room}</small></span></article>) : <p className="trainer-empty-note">No classes are scheduled for today.</p>}
      </section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">UP NEXT ON CAMPUS</span><h3>Upcoming events</h3></div><button className="link-button" onClick={() => setPage("events")}>Manage events <ArrowRight size={14} /></button></div>
        {overview.upcomingEvents.length ? overview.upcomingEvents.map((event) => <article className="trainer-announcement-row" key={event.id}><strong>{event.title}</strong><p>{event.location} · {new Date(`${event.date}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })}</p><small>{event.registrationCount} registered · capacity {event.capacity}</small></article>) : <p className="trainer-empty-note">No upcoming campus events.</p>}
      </section>
    </div>
    <div className="dashboard-grid coordinator-grid">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">FOLLOW-UP NEEDED</span><h3>Attendance & schedule alerts</h3></div><button className="link-button" onClick={() => setPage("attendance")}>Monitor attendance <ArrowRight size={14} /></button></div>
        {overview.missingAttendance.map((item) => <article className="coordinator-alert-row" key={item.id}><span className="coordinator-alert-icon"><CircleAlert size={16} /></span><span><strong>Attendance not submitted · {item.title}</strong><small>{item.trainer} · {item.room}</small></span></article>)}
        {overview.lowAttendance.map((student) => <article className="coordinator-alert-row" key={student.id}><span className="coordinator-alert-icon"><CircleAlert size={16} /></span><span><strong>Low attendance · {student.name}</strong><small>{student.percent}% attendance · review student support</small></span><button className="link-button" onClick={() => setPage("students")}>View</button></article>)}
        {!overview.missingAttendance.length && !overview.lowAttendance.length && <p className="trainer-empty-note">No attendance alerts right now.</p>}
      </section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">CAMPUS TEAM INBOX</span><h3>Pending requests</h3></div><button className="link-button" onClick={() => setPage("requests")}>Review requests <ArrowRight size={14} /></button></div>
        {overview.pendingRequests.length ? overview.pendingRequests.map((ticket) => <article className="trainer-announcement-row" key={ticket.id}><strong>{ticket.subject}</strong><p>{ticket.user} · {ticket.message}</p><small>{ticket.category?.replaceAll("_", " ") || "general"} · {ticket.status.replaceAll("_", " ")}</small></article>) : <p className="trainer-empty-note">No open requests at the moment.</p>}
      </section>
    </div>
    <footer className="page-footer"><span>COORDINATE WITH CARE <b>✳</b></span><span>ZYNGRAM CAMPUS HUB <i>·</i> 2026</span></footer>
  </div>;
}

function AdministratorDashboard({ user, setPage }) {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/admin/overview").then(setOverview).catch((err) => setError(err.message)); }, []);
  if (error) return <div className="page-content"><PageHeading eyebrow="ADMINISTRATOR CONSOLE" title={<>Campus control, <em>with care.</em></>} /><div className="global-error" role="alert">{error}</div></div>;
  if (!overview) return <div className="page-content"><PageHeading eyebrow="ADMINISTRATOR CONSOLE" title={<>Campus control, <em>with care.</em></>} /><section className="panel">Loading administrator dashboard…</section></div>;
  const cards = [
    ["Students", overview.counts.students, GraduationCap, "adminUsers"],
    ["Trainers", overview.counts.trainers, BriefcaseBusiness, "trainers"],
    ["Coordinators", overview.counts.coordinators, Building2, "coordinators"],
    ["Active courses", overview.counts.activeCourses, BookOpen, "adminCourses"],
    ["Active batches", overview.counts.activeBatches, Users, "batches"],
    ["Pending requests", overview.counts.pendingRequests, CircleHelp, "support"],
    ["Pending evaluations", overview.counts.pendingEvaluations, FileCheck2, "reports"]
  ];
  return <div className="page-content administrator-dashboard">
    <PageHeading eyebrow="ADMINISTRATOR CONSOLE" title={<>Welcome, {user.name.split(" ")[0]}<span className="heading-dot">.</span></>} subtitle="The full campus picture: people, learning, access, and the items that need attention." action={<button className="button button-outline" onClick={() => setPage("adminSettings")}><ShieldCheck size={15} /> System security</button>} />
    <section className="coordinator-welcome-panel admin-welcome-panel"><div><span className="eyebrow light-eyebrow">YOUR CAMPUS, SAFELY IN SYNC</span><h2>Keep the whole hub<br /><em>ready to grow.</em></h2><p>Manage campus access and learning operations from one clear, secure workspace.</p></div><div className="coordinator-shortcuts"><button className="button button-light" onClick={() => setPage("adminUsers")}><Plus size={15} /> Create account</button><button className="button button-outline" onClick={() => setPage("adminAudit")}><Clock3 size={15} /> Review activity</button></div></section>
    <div className="admin-dashboard-stats">{cards.map(([label, value, Icon, target]) => <button className="panel admin-dashboard-stat" key={label} onClick={() => setPage(target)}><span className="stat-icon green-icon"><Icon size={17} /></span><strong>{value}</strong><span>{label}</span><small>Open management <ArrowRight size={12} /></small></button>)}</div>
    <div className="dashboard-grid coordinator-grid">
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">RECENT ADMINISTRATIVE ACTIVITY</span><h3>Latest changes</h3></div><button className="link-button" onClick={() => setPage("adminAudit")}>Full audit log <ArrowRight size={14} /></button></div>
        {overview.recentActivities.length ? overview.recentActivities.map((item) => <article className="trainer-announcement-row" key={item.id}><strong>{item.action.replaceAll("_", " ")}</strong><p>{item.detail}</p><small>{item.actorName} · {new Date(item.createdAt).toLocaleString()}</small></article>) : <p className="trainer-empty-note">Administrative activity will be recorded here.</p>}
      </section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">SYSTEM & CAMPUS ALERTS</span><h3>Needs attention</h3></div><CircleAlert size={19} /></div>
        {overview.alerts.length ? overview.alerts.map((alert) => <article className="coordinator-alert-row" key={alert.id}><span className="coordinator-alert-icon"><CircleAlert size={16} /></span><span><strong>{alert.title}</strong><small>{alert.detail}</small></span><button className="link-button" onClick={() => setPage(alert.kind === "request" ? "support" : "reports")}>Review</button></article>) : <p className="trainer-empty-note">No urgent access or workflow alerts.</p>}
      </section>
    </div>
    <div className="dashboard-grid coordinator-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">CAMPUS CALENDAR</span><h3>Upcoming events</h3></div><button className="link-button" onClick={() => setPage("events")}>Manage events <ArrowRight size={14} /></button></div>{overview.upcomingEvents.length ? overview.upcomingEvents.map((event) => <article className="trainer-announcement-row" key={event.id}><strong>{event.title}</strong><p>{event.location} · {new Date(`${event.date}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })}</p></article>) : <p className="trainer-empty-note">No upcoming events.</p>}</section><section className="panel"><div className="panel-heading"><div><span className="eyebrow">QUICK ADMINISTRATION</span><h3>Tools & safeguards</h3></div><ShieldCheck size={19} /></div><div className="admin-dashboard-tools"><button onClick={() => setPage("adminPermissions")}>Review role permissions</button><button onClick={() => setPage("adminCourses")}>Manage course catalog</button><button onClick={() => setPage("adminSettings")}>Configure session policy</button><button onClick={() => setPage("reports")}>Open campus reports</button></div></section></div>
  </div>;
}

function CoordinatorStudentsPage() {
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [targetBatch, setTargetBatch] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  async function reload() {
    const [studentList, batchList] = await Promise.all([api("/coordinator/students"), api("/batches")]);
    setStudents(studentList);
    setBatches(batchList);
  }
  useEffect(() => { reload().catch((err) => setError(err.message)); }, []);
  async function assign(student) {
    const batchId = targetBatch[student.id];
    if (!batchId) { setError("Choose a batch before assigning this student."); return; }
    setBusyId(student.id); setError(""); setNotice("");
    try {
      await api(`/batches/${batchId}/learners`, { method: "POST", body: JSON.stringify({ learnerId: student.id }) });
      setNotice(`${student.name} is now assigned to the selected batch.`);
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusyId(""); }
  }
  const filtered = students.filter((student) => `${student.name} ${student.email} ${student.zinId || ""} ${student.batches.map((batch) => batch.name).join(" ")}`.toLowerCase().includes(search.toLowerCase())
    && (filter === "all" || filter === "assigned" && student.batches.length > 0
      || filter === "unassigned" && student.batches.length === 0
      || student.batches.some((batch) => batch.id === filter)));
  return <div className="page-content platform-page coordinator-management-page">
    <PageHeading eyebrow="STUDENT MANAGEMENT" title={<>Every learner, <em>in view.</em></>} subtitle="Search student IDs, view enrollment and batch details, and move a learner to the correct course batch." />
    {(error || notice) && <FormNotice error={error} notice={notice} />}
    <section className="panel coordinator-search-panel"><label htmlFor="coordinator-student-search"><Search size={16} /> Search students<input id="coordinator-student-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, ZIN ID, or batch" /></label><label className="coordinator-student-filter" htmlFor="coordinator-student-filter">Filter<select id="coordinator-student-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All enrollment</option><option value="assigned">Assigned</option><option value="unassigned">Not assigned</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></label><span>{filtered.length} students</span></section>
    <section className="panel coordinator-table-panel"><div className="table-wrap"><table><thead><tr><th>STUDENT</th><th>ENROLLMENT</th><th>ASSIGNED BATCHES</th><th>MOVE / ASSIGN BATCH</th></tr></thead><tbody>{filtered.map((student) => <tr key={student.id}><td><strong>{student.name}</strong><small className="trainer-student-email">{student.zinId || student.id} · {student.email}</small><details className="coordinator-profile-details"><summary>View profile</summary><span>{student.phone || "No phone"} · {student.skills || "No skills listed"}</span><small>{student.courses.join(", ") || "No course enrollments"}{student.bio ? ` · ${student.bio}` : ""}</small></details></td><td><Pill tone={student.enrollmentStatus === "active" ? "green" : "orange"}>{student.enrollmentStatus}</Pill></td><td>{student.batches.length ? student.batches.map((batch) => <span className="coordinator-batch-chip" key={batch.id}>{batch.name}<small>{batch.course}</small></span>) : "Not assigned"}</td><td><div className="coordinator-assignment-control"><select aria-label={`Select batch for ${student.name}`} value={targetBatch[student.id] || ""} onChange={(event) => setTargetBatch({ ...targetBatch, [student.id]: event.target.value })}><option value="">Choose batch</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name} · {batch.course}</option>)}</select><button className="button button-outline button-small" disabled={busyId === student.id || !targetBatch[student.id]} onClick={() => assign(student)}>{busyId === student.id ? "Saving…" : "Assign"}</button></div></td></tr>)}</tbody></table>{!filtered.length && <Empty icon={Search} title="No matching students." text="Try a different name, email, student ID, or batch." />}</div></section>
  </div>;
}

function CoordinatorTrainersPage() {
  const [trainers, setTrainers] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { api("/coordinator/trainers").then(setTrainers).catch((err) => setError(err.message)); }, []);
  return <div className="page-content platform-page coordinator-management-page"><PageHeading eyebrow="TRAINER MANAGEMENT" title={<>Meet the teaching <em>team.</em></>} subtitle="Review trainer profiles, assigned courses and batches, and upcoming teaching workload. Account permissions stay under administrator control." />{error && <FormNotice error={error} />}<div className="coordinator-trainer-grid">{trainers.map((trainer) => <article className="panel coordinator-trainer-card" key={trainer.id}><div className="coordinator-trainer-card-heading"><Avatar user={{ name: trainer.name, color: "mint" }} /><span><strong>{trainer.name}</strong><small>{trainer.trainerId}</small></span><Pill tone="green">Trainer</Pill></div><a href={`mailto:${trainer.email}`}>{trainer.email}</a><p>{trainer.title || "Campus trainer"}{trainer.phone ? ` · ${trainer.phone}` : ""}</p><div className="coordinator-workload-stats"><span><strong>{trainer.courses.length}</strong><small>Courses</small></span><span><strong>{trainer.batches.length}</strong><small>Batches</small></span><span><strong>{trainer.upcomingClasses}</strong><small>Classes</small></span></div><div className="coordinator-trainer-assigned"><strong>Assigned batches</strong><small>{trainer.batches.join(", ") || "No batches assigned"}</small><strong>Courses</strong><small>{trainer.courses.join(", ") || "No courses assigned"}</small>{trainer.skills && <small>Skills: {trainer.skills}</small>}</div></article>)}{!error && !trainers.length && <Empty icon={BriefcaseBusiness} title="No trainer accounts yet." text="Trainer profiles will appear here when accounts are added by an administrator." />}</div></div>;
}

function Courses({ courses }) {
  return <div className="page-content"><PageHeading eyebrow="YOUR SOFTWARE LEARNING PATH" title={<>Build skills. Ship <em>software.</em></>} subtitle="Explore practical courses in web development, AI, machine learning, data structures, and more." /><div className="course-grid">{courses.map((course, index) => <article className={`course-card course-card-${course.color}`} key={course.id}><div className="course-card-top"><span className="course-category">{course.category}</span><span className="course-level">PRACTICAL</span></div><span className={`course-illustration illus-${course.color}`}>{course.icon}</span><h3>{course.title}</h3><p>{course.description || "Learn by building real software projects and applying each concept in practice."}</p><div className="course-meta"><Avatar user={{ initials: course.trainer.split(" ").map((part) => part[0]).join(""), color: course.color }} small /><span>{course.trainer}</span><i>·</i><span>{course.schedule.split(",")[0]}</span></div><div className="course-card-progress"><div><span>YOUR PROGRESS</span><strong>{course.progress}%</strong></div><div className="progress-track"><span style={{ width: `${course.progress}%` }} /></div></div><span className="course-number">0{index + 1}</span></article>)}</div><div className="soft-note"><span>✳</span><span><strong>Build as you learn.</strong> Practice with real software projects and keep your progress moving.</span></div></div>;
}

function Modules({ modules, user, refresh }) {
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isAdmin = user.role === "administrator";

  function startEdit(module) {
    setEditing(module);
    setTitle(module.title);
    setCategory(module.category);
    setDescription(module.description);
    setError("");
    setSuccess("");
  }

  function resetForm() {
    setEditing(null);
    setTitle("");
    setCategory("");
    setDescription("");
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(editing ? `/modules/${editing.id}` : "/modules", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({ title, category, description })
      });
      resetForm();
      setSuccess(editing ? "Module details updated." : "Your new module is ready for learners.");
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(module) {
    if (!window.confirm(`Delete "${module.title}"? This cannot be undone.`)) return;
    setError("");
    setSuccess("");
    try {
      await api(`/modules/${module.id}`, { method: "DELETE" });
      if (editing?.id === module.id) resetForm();
      setSuccess("Module deleted.");
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return <div className="page-content">
    <PageHeading eyebrow={isAdmin ? "CAMPUS CONTENT" : "YOUR LEARNING SPACE"} title={isAdmin ? <>Shape the <em>learning journey.</em></> : <>A little more room to <em>learn.</em></>} subtitle={isAdmin ? "Create, update, and retire the learning modules available to your campus." : "Explore the learning modules available at your campus."} />
    {isAdmin && <form className="panel module-editor" onSubmit={save}>
      <div className="panel-heading"><div><span className="eyebrow">{editing ? "UPDATE MODULE" : "ADD A MODULE"}</span><h3>{editing ? "A fresh chapter." : "Make room for a new idea."}</h3></div>{editing && <button className="button button-outline" type="button" onClick={resetForm}>Cancel edit</button>}</div>
      <div className="module-form-fields"><label>Module title<input maxLength="120" value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="e.g. Creative problem solving" /></label><label>Category<input maxLength="80" value={category} onChange={(event) => setCategory(event.target.value)} required placeholder="e.g. WORKSHOP" /></label></div>
      <label>Short description<textarea maxLength="1000" rows="3" value={description} onChange={(event) => setDescription(event.target.value)} required placeholder="What will learners explore in this module?" /></label>
      <div className="module-editor-bottom"><Notice error={error} success={success} /><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save module" : "Add module"}{editing ? <Check size={15} /> : <Plus size={15} />}</button></div>
    </form>}
    {!isAdmin && <Notice error={error} success={success} />}
    {modules.length ? <div className="module-grid">{modules.map((module, index) => <article className={`module-card module-card-${index % 3}`} key={module.id}><span className="module-card-icon"><BookOpen size={20} /></span><span className="course-category">{module.category}</span><h3>{module.title}</h3><p>{module.description}</p>{isAdmin && <div className="module-card-actions"><button className="button button-outline" onClick={() => startEdit(module)}>Edit</button><button className="button button-outline module-delete" onClick={() => remove(module)}>Delete</button></div>}<span className="module-card-index">0{index + 1}</span></article>)}</div> : <section className="panel"><Empty icon={BookOpen} title="No learning modules yet." text={isAdmin ? "Add the first module using the form above." : "Your campus team will add modules here soon."} /></section>}
  </div>;
}

function Tasks({ tasks, user, refresh }) {
  const [selected, setSelected] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [response, setResponse] = useState("");
  const [feedback, setFeedback] = useState("");
  const [review, setReview] = useState("reviewed");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const trainer = user.role !== "student";
  useEffect(() => { if (trainer) api("/submissions").then(setSubmissions).catch((err) => setError(err.message)); }, [trainer]);
  function openTask(item) { setSelected(item); setResponse(item.submissions[0]?.text || ""); setFeedback(""); setMessage(""); setError(""); }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (trainer) {
        await api(`/submissions/${selected.id}`, { method: "PATCH", body: JSON.stringify({ review, feedback }) });
        setMessage("Feedback saved. A little encouragement goes a long way."); setSubmissions(await api("/submissions"));
      } else {
        await api(`/tasks/${selected.id}/submissions`, { method: "POST", body: JSON.stringify({ text: response }) });
        setMessage("Your work is in. Nice one!"); await refresh();
      }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="page-content"><PageHeading eyebrow={trainer ? "MAKE SOMEONE'S DAY" : "MAKE PROGRESS, YOUR WAY"} title={trainer ? <>Thoughtful work deserves <em>thoughtful feedback.</em></> : <>A little progress, <em>every day.</em></>} subtitle={trainer ? "A few kind, specific words can change someone's whole week." : "Your work in one place, with a little breathing room."} /><section className="panel tasks-full"><div className="tabs-strip"><span className="tabs-active">{trainer ? "Submissions" : "All tasks"} <i>{trainer ? submissions.length : tasks.length}</i></span><span className="task-filter-label"><Search size={15} /> Recently updated <ChevronDown size={14} /></span></div>{trainer ? submissions.length ? submissions.map((item) => <button className="submission-row" key={item.id} onClick={() => openTask(item)}><span className="submission-portrait"><Avatar user={{ name: item.student, color: "peach" }} /></span><span className="submission-copy"><span>{item.course} <i>·</i> {item.student}</span><strong>{item.task}</strong><small>{item.text}</small></span><Pill tone={item.review === "submitted" ? "orange" : item.review === "needs work" ? "pink" : "green"}>{item.review}</Pill><ArrowRight size={16} /></button>) : <Empty icon={FileCheck2} title="Nothing to review just yet." text="New learner submissions will show up right here." /> : tasks.map((task) => { const submission = task.submissions[0]; return <article className="task-row" key={task.id}><span className={`task-row-icon ${task.status === "submitted" ? "task-icon-done" : ""}`}>{task.status === "submitted" ? <Check size={18} /> : <FileCheck2 size={18} />}</span><span className="task-row-main"><span className="course-category">{task.course}</span><strong>{task.title}</strong><small>{task.detail}</small>{submission?.feedback && <span className="feedback-snippet"><MessageCircle size={14} /> {submission.feedback}</span>}</span><span className="task-row-due"><small>DUE DATE</small><strong>{new Date(`${task.due}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })}</strong></span><Pill tone={submission?.review === "reviewed" ? "green" : submission?.review === "needs work" ? "pink" : submission ? "blue" : "orange"}>{submission?.review === "needs work" ? "Needs a tweak" : submission?.review || task.status}</Pill><button className="button button-small button-outline" onClick={() => openTask(task)}>{submission ? "View work" : "Open task"}</button></article>; })}</section><footer className="task-footer"><span><ShieldCheck size={15} /> Your work is private to your learning team.</span><span>Showing {trainer ? submissions.length : tasks.length} {trainer ? "submissions" : "tasks"}</span></footer>
    {selected && <Modal title={trainer ? `Feedback · ${selected.task}` : selected.title} onClose={() => setSelected(null)}>{trainer ? <form className="modal-form" onSubmit={submit}><p className="modal-context">{selected.student} · {selected.course}<br /><br />“{selected.text}”</p><label htmlFor="review-status">Your review</label><select id="review-status" value={review} onChange={(event) => setReview(event.target.value)}><option value="reviewed">Ready for the next step</option><option value="needs work">A little more work needed</option></select><label htmlFor="feedback">A note for {selected.student.split(" ")[0]}</label><textarea id="feedback" rows="4" maxLength="1000" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Share something specific you liked, then one gentle next step…" required /><Notice error={error} success={message} /><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Send feedback"}<Send size={15} /></button></form> : <form className="modal-form" onSubmit={submit}><p className="modal-context">{selected.course} · Due {new Date(`${selected.due}T12:00:00`).toLocaleDateString("en", { month: "long", day: "numeric" })}<br /><br />{selected.detail}{selected.submissions[0]?.feedback && <><br /><br /><strong>Trainer feedback:</strong> {selected.submissions[0].feedback}</>}</p><label htmlFor="task-response">Your response</label><textarea id="task-response" rows="5" maxLength="3000" readOnly={selected.submissions[0]?.review === "reviewed"} value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Write a few words about your work or share your idea…" required /><small className="field-hint">{response.length}/3,000 characters</small><Notice error={error} success={message} /><button className="button button-primary" disabled={busy || selected.submissions[0]?.review === "reviewed"}>{busy ? "Sending…" : selected.submissions[0]?.review === "needs work" ? "Submit revised work" : selected.submissions[0]?.review === "reviewed" ? "Reviewed" : selected.submissions[0] ? "Update submission" : "Submit your work"}<ArrowRight size={15} /></button></form>}</Modal>}</div>;
}

function Attendance({ records, courses, user, refresh }) {
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [learners, setLearners] = useState([]);
  const [learnerId, setLearnerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("present");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState(null);
  const canMark = ["trainer", "administrator"].includes(user.role);
  useEffect(() => {
    if (!canMark) return;
    api("/learners").then((items) => {
      setLearners(items);
      setLearnerId(items[0]?.id || "");
    }).catch((err) => setError(err.message));
  }, [canMark]);
  async function checkInWithCode(code) {
    setBusy(true); setError(""); setSuccess("");
    try {
      await api("/attendance/check-in", { method: "POST", body: JSON.stringify({ code }) });
      await refresh(); setSuccess("QR check-in complete. You're marked present for this course.");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function createCheckInQr() {
    setBusy(true); setError(""); setSuccess(""); setQr(null);
    try { setQr(await api("/attendance/check-in-code", { method: "POST", body: JSON.stringify({ courseId }) })); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function markAttendance(event) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      await api("/attendance/mark", { method: "POST", body: JSON.stringify({ studentId: learnerId, courseId, date, status }) });
      await refresh(); setSuccess("Attendance saved for the selected learner.");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const percent = records.length ? Math.round(records.filter((item) => item.status !== "absent").length / records.length * 100) : 0;
  return <div className="page-content"><PageHeading eyebrow="SHOWING UP IS A SUPERPOWER" title={<>Every day you show up, <em>counts.</em></>} subtitle="Scan a staff-issued course QR or paste its short-lived code to check in." />{(error || success) && <div className={error ? "inline-alert error-alert" : "inline-alert success-alert"} role="status">{error || success}</div>}
    {user.role === "student" && <QrScanner label="Student QR check-in" onScan={checkInWithCode} />}
    {canMark && <form className="panel attendance-mark-form" onSubmit={markAttendance}><div className="panel-heading"><div><span className="eyebrow">{user.role === "trainer" ? "TRAINER TOOL" : "ADMINISTRATOR TOOL"}</span><h3>Record learner attendance</h3></div><button className="button button-outline button-small" type="button" disabled={busy || !courseId} onClick={createCheckInQr}><QrCode size={14} /> Create 10-minute QR</button></div><div className="attendance-mark-fields"><label>Learner<select value={learnerId} onChange={(event) => setLearnerId(event.target.value)} required><option value="" disabled>Select a learner</option>{learners.map((learner) => <option key={learner.id} value={learner.id}>{learner.name} · {learner.email}</option>)}</select></label><label>Course<select value={courseId} onChange={(event) => setCourseId(event.target.value)} required><option value="" disabled>Select a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></select></label><button className="button button-primary" disabled={busy || !learnerId || !courseId}>{busy ? "Saving…" : "Save attendance"}<Check size={15} /></button></div>{qr && <div className="qr-display"><img src={qr.qrDataUrl} alt={`Attendance QR code for ${qr.course}`} /><span><strong>{qr.course}</strong><small>Expires {new Date(qr.expiresAt).toLocaleTimeString()}</small></span></div>}</form>}
    <div className="attendance-cards"><article className="attendance-summary"><div><span className="eyebrow light-eyebrow">{user.role === "coordinator" ? "CAMPUS ATTENDANCE" : user.role === "student" ? "YOUR ATTENDANCE" : "TEAM ATTENDANCE"}</span><h2>{percent}<small>%</small></h2><p>{user.role === "coordinator" ? "A campus-wide view of attendance records." : "Consistency is a kindness to future you."}</p></div><div className="attendance-ring"><span>{records.filter((item) => item.status === "present").length}</span><small>sessions</small></div></article><article className="attendance-note"><span className="note-sun">☼</span><span className="eyebrow">{user.role === "coordinator" ? "MONITORING ONLY" : "A THOUGHT FOR TODAY"}</span><h3>{user.role === "coordinator" ? <>Spot patterns.<br />Offer support.</> : <>Be where your<br />feet are.</>}</h3><p>{user.role === "coordinator" ? "Coordinators can review attendance and alerts; trainers record the class." : "Every session is a chance to try, ask, and find your people."}</p><span className="note-author">A LITTLE REMINDER <b>·</b> ZYNGRAM</span></article></div><section className="panel attendance-table"><div className="panel-heading"><div><span className="eyebrow">{user.role === "coordinator" ? "CAMPUS-WIDE MONITORING" : "YOUR LEARNING FOOTPRINT"}</span><h3>{user.role === "student" ? "Recent sessions" : "Campus attendance"}</h3></div><span className="button button-outline button-small"><CalendarDays size={15} /> All time</span></div><div className="table-wrap"><table><thead><tr><th>DATE</th>{user.role !== "student" && <th>LEARNER</th>}<th>SESSION</th><th>STATUS</th><th>CHECK-IN</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{new Date(`${record.date}T12:00:00`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}</td>{user.role !== "student" && <td>{record.student}</td>}<td>{record.course}</td><td><Pill tone={record.status === "present" ? "green" : record.status === "late" ? "orange" : "pink"}>{record.status}</Pill></td><td><span className="checkin-time"><i />{record.status === "present" ? "On time" : record.status === "late" ? "A little late" : "Not checked in"}</span></td></tr>)}</tbody></table>{!records.length && <Empty icon={CalendarDays} title="No sessions recorded yet." text="Your attendance will find its way here." />}</div></section></div>;
}

function Announcements({ notes, courses, user, refresh }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [batches, setBatches] = useState([]);
  const canPost = ["trainer", "coordinator", "administrator"].includes(user.role);
  useEffect(() => {
    if (user.role === "coordinator" || user.role === "administrator") {
      api("/batches").then(setBatches).catch((err) => setError(err.message));
    }
  }, [user.role]);
  async function createNote(event) {
    event.preventDefault(); setError(""); setSuccess("");
    const form = new FormData(event.currentTarget);
    const selectedRoles = form.getAll("selectedRoles");
    try {
      await api("/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: form.get("title"),
          body: form.get("body"),
          ...(user.role === "trainer" ? { courseId: form.get("courseId") } : {}),
          ...(form.get("batchId") ? { batchId: form.get("batchId") } : {}),
          ...(selectedRoles.length ? { selectedRoles } : {})
        })
      });
      await refresh(); setOpen(false); setSuccess(user.role === "trainer" ? "Course update sent to enrolled learners." : form.get("batchId") ? "Update sent to the selected batch." : selectedRoles.length ? "Announcement sent to the selected roles." : "Your note is on the community board.");
    }
    catch (err) { setError(err.message); }
  }
  return <div className="page-content"><PageHeading eyebrow="THE CAMPUS COMMUNITY, IN THE LOOP" title={<>Little notes, <em>big picture.</em></>} subtitle="The useful, the lovely, and the things worth knowing." action={canPost && <button className="button button-primary" onClick={() => { setError(""); setOpen(true); }}><Plus size={16} /> Write an update</button>} />{success && <div className="inline-alert success-alert" role="status">{success}</div>}<div className="announcement-feed">{notes.map((note, index) => <article className={`announcement-card feed-${note.color}`} key={note.id}><div className="announcement-card-top"><Pill tone="blue">{note.tag}</Pill><span>{new Date(`${note.date}T12:00:00`).toLocaleDateString("en", { month: "long", day: "numeric" })}</span></div><div className={`announcement-art art-${note.color}`}>{note.tag === "CAMPUS" ? "✳" : note.tag === "WELLBEING" ? "☼" : "✦"}<small>0{index + 1}</small></div><h3>{note.title}</h3><p>{note.body}</p><div className="announcement-byline"><Avatar user={{ name: note.author, color: note.color === "peach" ? "peach" : "lilac" }} small /><span><strong>{note.author}</strong><small>Campus community</small></span><ArrowUpRight size={16} /></div></article>)}{!notes.length && <Empty icon={Bell} title="It's quiet on the board." text="Check back soon for a note from your campus." />}</div>
    {open && <Modal title={user.role === "trainer" ? "Send a course update" : "A note for your campus"} onClose={() => setOpen(false)}><form className="modal-form" onSubmit={createNote}><p className="modal-context">{user.role === "trainer" ? "This update will be visible to learners enrolled in the selected course." : "A clear, warm update helps everyone feel in the loop."}</p>{user.role === "trainer" && <label htmlFor="announcement-course">Course<select id="announcement-course" name="courseId" required>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>}{user.role === "coordinator" && <label htmlFor="announcement-batch">Audience<select id="announcement-batch" name="batchId"><option value="">All campus</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></label>}{user.role === "administrator" && <label htmlFor="announcement-roles">Send to selected roles (leave empty for all campus)<select id="announcement-roles" name="selectedRoles" multiple size="5">{[["student", "Students"], ["trainer", "Trainers"], ["coordinator", "Coordinators"], ["administrator", "Administrators"], ["placement_officer", "Placement officers"]].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}<label htmlFor="announcement-title">Headline</label><input id="announcement-title" name="title" maxLength="120" required placeholder="What would you like everyone to know?" /><label htmlFor="announcement-body">Your note</label><textarea id="announcement-body" name="body" rows="5" maxLength="1000" required placeholder="Share the details in a few friendly lines…" /><Notice error={error} /><button className="button button-primary">{user.role === "trainer" ? "Send course update" : "Post campus update"} <Send size={15} /></button></form></Modal>}</div>;
}

function Support({ user }) {
  const [tickets, setTickets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [responses, setResponses] = useState({});
  const coordinatorView = ["coordinator", "administrator"].includes(user.role);
  async function reload() {
    setTickets(await api("/support"));
  }
  useEffect(() => { reload().catch((err) => setError(err.message)); }, []);
  async function send(event) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    const form = new FormData(event.currentTarget);
    try { await api("/support", { method: "POST", body: JSON.stringify({ subject: form.get("subject"), category: form.get("category"), message }) }); await reload(); setSuccess("Your note is with our campus team. We'll be in touch."); setMessage(""); event.currentTarget.reset(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function updateTicket(ticket) {
    setBusy(true); setError(""); setSuccess("");
    try {
      await api(`/support/${ticket.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: ticket.nextStatus || ticket.status, response: responses[ticket.id] ?? ticket.response ?? "" })
      });
      await reload(); setSuccess("Request status updated.");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="page-content"><PageHeading eyebrow={coordinatorView ? "CAMPUS REQUESTS & ISSUES" : "YOU DON'T HAVE TO FIGURE IT OUT ALONE"} title={coordinatorView ? <>A clear path from issue to <em>resolution.</em></> : <>We're here, <em>right around the corner.</em></>} subtitle={coordinatorView ? "Review student and trainer requests, track progress, and document the next step. Role permissions remain managed by administrators." : "Questions, ideas, or a small snag? Send a note. A real human will help you find your next step."} />
    {coordinatorView ? <section className="panel coordinator-requests-panel"><div className="panel-heading"><div><span className="eyebrow">REQUEST QUEUE</span><h3>{tickets.filter((ticket) => ticket.status !== "resolved").length} open requests</h3></div><CircleHelp size={19} /></div>{tickets.length ? tickets.map((ticket) => <article className="coordinator-request-card" key={ticket.id}><div className="coordinator-request-heading"><span><strong>{ticket.subject}</strong><small>{ticket.user} · {new Date(ticket.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</small></span><Pill tone={ticket.status === "resolved" ? "green" : ticket.status === "in_progress" ? "blue" : "orange"}>{ticket.status.replaceAll("_", " ")}</Pill></div><p>{ticket.message}</p><small className="coordinator-request-category">{(ticket.category || "general").replaceAll("_", " ")}{ticket.batchName ? ` · ${ticket.batchName}` : ""}</small>{ticket.response && <p className="coordinator-request-response"><strong>Coordinator update:</strong> {ticket.response}</p>}<div className="coordinator-request-actions"><select aria-label={`Status for ${ticket.subject}`} value={ticket.nextStatus || ticket.status} onChange={(event) => setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, nextStatus: event.target.value } : item))}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select><input aria-label={`Response to ${ticket.subject}`} maxLength="500" value={responses[ticket.id] ?? ticket.response ?? ""} onChange={(event) => setResponses({ ...responses, [ticket.id]: event.target.value })} placeholder="Add an update or next step" /><button className="button button-outline button-small" disabled={busy} onClick={() => updateTicket(ticket)}>Save update</button></div></article>) : <Empty icon={CircleHelp} title="No campus requests yet." text="New student and trainer requests will appear here." />}</section>
      : <><div className="support-layout"><div className="support-intro"><div className="support-orbit"><span>?</span><i /><b /><em>✦</em></div><div className="support-info"><span className="eyebrow">CAMPUS CARE, FROM REAL PEOPLE</span><h3>Tell us what's on your mind.</h3><p>Your message goes to the campus support team. We typically reply within one working day.</p><div className="support-hours"><Clock3 size={16} /><span><strong>Monday – Friday</strong><small>9:00 AM – 5:00 PM IST</small></span></div><div className="support-hours"><ShieldCheck size={16} /><span><strong>Private by default</strong><small>Only you and our support team can see your note.</small></span></div></div></div><form className="panel support-form" onSubmit={send}><span className="eyebrow">WRITE US A NOTE</span><h3>A little more context helps.</h3><label htmlFor="support-category">Request type</label><select id="support-category" name="category"><option value="general">General support</option><option value="batch_change">Batch change request</option><option value="timetable_change">Timetable change request</option><option value="trainer_issue">Trainer coordination issue</option></select><label htmlFor="support-subject">What can we help with?</label><input id="support-subject" name="subject" maxLength="100" required placeholder="e.g. Finding my course schedule" /><label htmlFor="support-message">Tell us a bit more</label><textarea id="support-message" value={message} maxLength="1000" rows="5" onChange={(event) => setMessage(event.target.value)} required placeholder="A few details help us get you the right answer…" /><div className="form-bottom"><span>{message.length}/1,000</span><button className="button button-primary" disabled={busy}>{busy ? "Sending…" : "Send my note"}<Send size={15} /></button></div><Notice error={error} success={success} /></form></div></>}
    {tickets.length > 0 && !coordinatorView && <section className="panel ticket-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR NOTES</span><h3>A little follow-through.</h3></div></div>{tickets.map((ticket) => <div className="ticket-row" key={ticket.id}><span><strong>{ticket.subject}</strong><small>{new Date(ticket.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}{ticket.response ? ` · ${ticket.response}` : ""}</small></span><Pill tone={ticket.status === "resolved" ? "green" : "orange"}>{ticket.status.replaceAll("_", " ")}</Pill></div>)}</section>}</div>;
}

function DesignModel() {
  const [active, setActive] = useState(0);
  useEffect(() => { const handle = (event) => { if (event.key === "ArrowRight") setActive((value) => (value + 1) % slides.length); if (event.key === "ArrowLeft") setActive((value) => (value + slides.length - 1) % slides.length); }; window.addEventListener("keydown", handle); return () => window.removeEventListener("keydown", handle); }, []);
  const [eyebrow, title, text, takeAway, Icon] = slides[active];
  return <div className="page-content"><PageHeading eyebrow="THE THINKING BEHIND THE HUB" title={<>A small idea, <em>made visible.</em></>} subtitle="A short story about the experience, who it's for, and what we'd build next." action={<span className="slide-count">{String(active + 1).padStart(2, "0")} <i>/</i> {String(slides.length).padStart(2, "0")}</span>} /><section className="presentation-stage"><div className="slide-meta"><span className="eyebrow light-eyebrow">{eyebrow}</span><span className="slide-brand">ZYngram <b>·</b> CAMPUS HUB</span></div><div className="slide-main"><span className="slide-symbol"><Icon size={34} strokeWidth={1.6} /></span><h2>{title}</h2><p>{text}</p><div className="slide-takeaway"><span>✳</span>{takeAway}</div></div><div className="slide-bottom"><span>A LEARNING EXPERIENCE, DESIGNED WITH CARE</span><div className="slide-controls"><button aria-label="Previous slide" onClick={() => setActive((active + slides.length - 1) % slides.length)}><ChevronLeft size={18} /></button>{slides.map((slide, index) => <button key={slide[0]} aria-label={`Go to slide ${index + 1}`} className={`slide-dot ${active === index ? "slide-dot-active" : ""}`} onClick={() => setActive(index)} />)}<button aria-label="Next slide" onClick={() => setActive((active + 1) % slides.length)}><ChevronRight size={18} /></button></div></div><span className="presentation-orbit presentation-orbit-one" /><span className="presentation-orbit presentation-orbit-two" /><span className="presentation-star">✳</span><span className="presentation-planet">✦</span></section><div className="presentation-tip"><Sparkles size={16} /><span><strong>Presenter's note</strong> Use the arrow keys to move through this seven-slide introduction. The complete design rationale and user journeys are in README.</span></div></div>;
}

function Modal({ title, children, onClose }) {
  useEffect(() => { const handle = (event) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", handle); return () => window.removeEventListener("keydown", handle); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>{children}</section></div>;
}

function Profile({ user, updateUser }) {
  const [name, setName] = useState(user.name);
  const [title, setTitle] = useState(user.title || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [bio, setBio] = useState(user.bio || "");
  const [skills, setSkills] = useState(user.skills || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyAsset, setBusyAsset] = useState("");
  const [certificates, setCertificates] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [points, setPoints] = useState(0);
  useEffect(() => {
    if (user.role !== "student") return;
    Promise.all([api("/certificates"), api("/gamification")]).then(([courseCertificates, stats]) => {
      setCertificates(courseCertificates.filter((item) => item.eligible));
      setAchievements(stats.badges || []);
      setPoints(stats.points || 0);
    }).catch((err) => setError(err.message));
  }, [user.role]);
  async function uploadAsset(kind, event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBusyAsset(kind); setError(""); setSuccess("");
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const dataUrl = `data:${file.type};base64,${btoa(binary)}`;
      const result = await api(`/profile/assets/${kind}`, {
        method: "POST",
        body: JSON.stringify({ dataUrl, fileName: file.name })
      });
      updateUser(result.user);
      setSuccess(kind === "avatar" ? "Your profile photo has been updated." : "Your resume has been uploaded.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyAsset("");
    }
  }
  async function removeAsset(kind) {
    setBusyAsset(kind); setError(""); setSuccess("");
    try {
      const result = await api(`/profile/assets/${kind}`, { method: "DELETE" });
      updateUser(result.user);
      setSuccess(kind === "avatar" ? "Your profile photo has been removed." : "Your resume has been removed.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyAsset("");
    }
  }
  const completionItems = [name, title, phone, skills, bio, user.avatarUrl, user.resumeFileName];
  const profileCompletion = Math.round(completionItems.filter(Boolean).length / completionItems.length * 100);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const result = await api("/profile", { method: "PATCH", body: JSON.stringify({ name, title, phone, bio, skills }) });
      updateUser(result.user);
      setSuccess("Your profile has been saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="page-content">
    <PageHeading eyebrow="YOUR CAMPUS IDENTITY" title={<>Make this space <em>yours.</em></>} subtitle="Keep your contact details and learning profile up to date." />
    <div className="profile-layout">
      <section className="profile-summary panel">
        <div className="profile-photo-wrap"><Avatar user={user} /><label className="profile-photo-action" title="Upload profile photo"><Camera size={15} /><input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload profile photo" onChange={(event) => uploadAsset("avatar", event)} /></label></div>
        <div><h2>{user.name}</h2><p>{roleNames[user.role]}</p></div>
        <div className="profile-completion"><div><small>PROFILE COMPLETION</small><strong>{profileCompletion}%</strong></div><span><i style={{ width: `${profileCompletion}%` }} /></span></div>
        <span className="profile-summary-divider" />
        {user.zinId && <div className="profile-summary-detail"><small>YOUR ZIN ID</small><strong>{user.zinId}</strong></div>}
        {user.trainerId && <div className="profile-summary-detail"><small>TRAINER ID</small><strong>{user.trainerId}</strong></div>}
        {user.coordinatorId && <div className="profile-summary-detail"><small>COORDINATOR ID</small><strong>{user.coordinatorId}</strong></div>}
        {user.placementOfficerId && <div className="profile-summary-detail"><small>PLACEMENT OFFICER ID</small><strong>{user.placementOfficerId}</strong></div>}
        <div className="profile-summary-detail"><small>ACCOUNT EMAIL</small><strong>{user.email}</strong></div>
        <div className="profile-summary-detail"><small>PROFILE STATUS</small><strong>Managed by you</strong></div>
      </section>
      <div className="profile-main-column">
      <form className="profile-editor panel" onSubmit={save}>
        <div className="panel-heading"><div><span className="eyebrow">PERSONAL DETAILS</span><h3>Your profile</h3></div><ShieldCheck size={19} /></div>
        <div className="profile-fields">
          <label htmlFor="profile-name">Full name<input id="profile-name" maxLength="80" value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label htmlFor="profile-title">Role or headline<input id="profile-title" maxLength="120" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Software Development Trainee" /></label>
          <label htmlFor="profile-phone">Phone number<input id="profile-phone" type="tel" maxLength="32" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Optional" /></label>
          <label htmlFor="profile-skills">Skills<input id="profile-skills" maxLength="300" value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="e.g. JavaScript, React, Node.js" /></label>
          <label className="profile-bio-field" htmlFor="profile-bio">About you<textarea id="profile-bio" maxLength="500" rows="4" value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Share a little about your learning goals or experience." /><small>{bio.length}/500 characters</small></label>
        </div>
        <p className="profile-email-note">Account email and access role are managed securely and can't be changed here.</p>
        <Notice error={error} success={success} />
        <div className="profile-save-row"><span><ShieldCheck size={15} /> Only you can update your personal profile.</span><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}<Check size={15} /></button></div>
      </form>
      <section className="profile-assets panel">
        <div className="panel-heading"><div><span className="eyebrow">CAREER TOOLKIT</span><h3>Resume</h3></div><FileText size={19} /></div>
        <p>Keep your latest resume ready for opportunities. PDF files up to 2 MB.</p>
        <div className="profile-resume-row">
          <span className="profile-resume-icon"><FileText size={19} /></span>
          <span className="profile-resume-copy"><strong>{user.resumeFileName || "No resume uploaded yet"}</strong><small>{user.resumeFileName ? "Private · only available to you" : "Upload a PDF resume to complete your profile"}</small></span>
          {user.resumeFileName && <a className="button button-outline button-small" href="/api/profile/assets/resume"><Upload size={14} /> Download</a>}
          {user.resumeFileName && <button className="icon-button" type="button" aria-label="Remove resume" disabled={Boolean(busyAsset)} onClick={() => removeAsset("resume")}><Trash2 size={15} /></button>}
          <label className="button button-primary button-small profile-upload-button">{busyAsset === "resume" ? "Uploading…" : user.resumeFileName ? "Replace" : "Upload resume"}<Upload size={14} /><input type="file" accept="application/pdf,.pdf" aria-label="Upload PDF resume" disabled={Boolean(busyAsset)} onChange={(event) => uploadAsset("resume", event)} /></label>
        </div>
      </section>
      {user.role === "student" && <section className="profile-assets panel">
        <div className="panel-heading"><div><span className="eyebrow">YOUR PROGRESS, CELEBRATED</span><h3>Achievements & certificates</h3></div><Award size={19} /></div>
        <div className="profile-achievement-stats"><span><Sparkles size={16} /><strong>{points}</strong><small>learning points</small></span><span><Medal size={16} /><strong>{achievements.length}</strong><small>badges earned</small></span><span><Award size={16} /><strong>{certificates.length}</strong><small>certificates</small></span></div>
        <div className="profile-badge-list">{achievements.length ? achievements.map((badge) => <span className="profile-badge" key={badge}><Medal size={15} />{badge}</span>) : <p className="profile-empty-note">Keep learning to earn your first badge.</p>}</div>
        <div className="profile-certificate-list">{certificates.length ? certificates.map((certificate) => <article className="profile-certificate-card" key={certificate.courseId}><span className="profile-certificate-icon"><GraduationCap size={19} /></span><span><strong>{certificate.course}</strong><small>Completed {new Date(certificate.issuedAt).toLocaleDateString("en", { month: "short", year: "numeric" })} · ID {certificate.certificateId}</small></span><a className="button button-outline button-small" href={`/api/certificates/${certificate.courseId}/pdf`}><FileCheck2 size={14} /> View certificate</a></article>) : <p className="profile-empty-note">Course certificates will appear here when you complete all lessons and pass every module assignment.</p>}</div>
      </section>}
      {user.role === "student" && <StudentPortfolio />}
      </div>
    </div>
  </div>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("overview");
  const [data, setData] = useState({ courses: [], tasks: [], announcements: [], attendance: [], modules: [], counts: { learners: 0, pendingReviews: 0 }, attendancePercent: 0, upcomingClasses: [], learningPoints: 0, learningProgress: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    api("/auth/me").then(({ user: current }) => setUser(current)).catch((err) => {
      if (err.status !== 401) setError(err.message);
    });
  }, []);
  useEffect(() => {
    const handleSessionExpired = (event) => {
      if (!user) return;
      setUser(null);
      setPage("overview");
      setError(`${event.detail?.message || "Your sign-in session has expired."} Please sign in again.`);
    };
    window.addEventListener("campus-session-expired", handleSessionExpired);
    return () => window.removeEventListener("campus-session-expired", handleSessionExpired);
  }, [user]);
  async function refresh() {
    if (!user || user.mustChangePassword) return;
    const [dashboard, attendance, modules, courses] = await Promise.all([api("/dashboard"), api("/attendance"), api("/modules"), api("/courses")]);
    setData({ ...dashboard, attendance, modules, courses });
  }
  useEffect(() => { refresh().catch((err) => setError(err.message)); }, [user]);
  async function login(email, password, role) {
    setBusy(true); setError("");
    try {
      const result = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password, role }) });
      setUser(result.user);
      setPage("overview");
    }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function changeStaffPassword(password, confirmPassword) {
    setBusy(true); setError("");
    try {
      const result = await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ password, confirmPassword })
      });
      setUser(result.user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function register(name, password, confirmPassword) {
    setBusy(true); setError("");
    try {
      return await api("/auth/register", { method: "POST", body: JSON.stringify({ name, password, confirmPassword }) });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function logout() {
    try { await api("/auth/logout", { method: "POST", body: "{}" }); }
    catch (err) { setError(err.message); return; }
    setUser(null); setPage("overview"); setData({ courses: [], tasks: [], announcements: [], attendance: [], modules: [], counts: { learners: 0, pendingReviews: 0 }, attendancePercent: 0, upcomingClasses: [], learningPoints: 0, learningProgress: 0 });
  }
  if (!user) return <Login onLogin={login} onRegister={register} busy={busy} error={error} />;
  if (user.mustChangePassword) return <PasswordSetup onSubmit={changeStaffPassword} onSignOut={logout} busy={busy} error={error} />;
  const pageTitles = {
    overview: user.role === "trainer" ? "Trainer dashboard" : user.role === "coordinator" ? "Coordinator dashboard" : user.role === "administrator" ? "Administrator dashboard" : user.role === "placement_officer" ? "Placement dashboard" : "Smart dashboard", courses: user.role === "trainer" ? "My courses" : "Courses & learning", tasks: "Tasks & feedback", assignments: user.role === "trainer" ? "Assignments & evaluation" : user.role === "coordinator" ? "Tasks & assignments" : "Assignments",
    attendance: "Attendance", analytics: "Progress analytics", timetable: "Smart timetable", events: "Campus events", batches: "Batch allocation", learningPath: "Personalized learning path",
    assistant: "AI campus assistant", community: "Campus community", gamification: "Points & badges", career: "Career & placements",
    notifications: "Notifications", announcements: "Announcements", support: user.role === "coordinator" ? "Requests & issues" : "Help & support",
    modules: user.role === "administrator" ? "Manage modules" : "Learning modules",
    adminUsers: "User management", adminPermissions: "Roles & permissions", adminCourses: "Course management",
    adminAudit: "Audit logs", apiManagement: "API management", adminSettings: "System settings", coordinators: "Coordinator management",
    students: "Student management", trainers: "Trainer management",
    placementStudents: "Student profiles", placementCompanies: "Company management", placementJobs: "Jobs & internships",
    placementDrives: "Placement drives", placementApplications: "Applications & shortlisting",
    placementInterviews: "Interview scheduling", placementOffers: "Selection & offers",
    placementResources: "Resume & career preparation", placementReports: "Placement reports",
    requests: "Requests & issues", reports: user.role === "trainer" ? "Student progress" : "Campus reports", design: "Design model", profile: "My profile"
  };
  const changePage = (next) => { setPage(next); setError(""); };
  return <div className="app-shell">
    <Sidebar page={page} setPage={changePage} user={user} onLogout={logout} mobileOpen={mobileOpen} closeMobile={() => setMobileOpen(false)} />
    <div className="main-area">
      <Header title={pageTitles[page] || "Overview"} user={user} onMenu={() => setMobileOpen(true)} onProfile={() => changePage("profile")} onNotifications={() => changePage("notifications")} />
      <nav className="design-shortcut"><button onClick={() => changePage("design")} className={page === "design" ? "shortcut-active" : ""}><Sparkles size={15} /> Our design model <ArrowRight size={14} /></button></nav>
      {error && !["overview", "tasks", "assignments"].includes(page) && <div className="global-error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={14} /></button></div>}
      {page === "overview" && (user.role === "trainer" ? <TrainerDashboard user={user} setPage={changePage} /> : user.role === "coordinator" ? <CoordinatorDashboard user={user} setPage={changePage} /> : user.role === "administrator" ? <AdministratorDashboard user={user} setPage={changePage} /> : user.role === "placement_officer" ? <PlacementOfficerDashboard user={user} setPage={changePage} /> : <Dashboard data={data} user={user} setPage={changePage} />)}
      {page === "students" && user.role === "coordinator" && <CoordinatorStudentsPage />}
      {page === "trainers" && user.role === "coordinator" && <CoordinatorTrainersPage />}
      {page === "trainers" && user.role === "administrator" && <AdminUsersPage defaultRole="trainer" />}
      {page === "coordinators" && user.role === "administrator" && <AdminUsersPage defaultRole="coordinator" />}
      {page === "requests" && user.role === "coordinator" && <Support user={user} />}
      {page === "courses" && (user.role === "trainer" ? <TrainerCoursesPage user={user} courses={data.courses} refresh={refresh} /> : <LearningHub courses={data.courses} user={user} refresh={refresh} />)}
      {page === "modules" && <Modules modules={data.modules} user={user} refresh={refresh} />}
      {page === "tasks" && <Tasks tasks={data.tasks} user={user} refresh={refresh} />}
      {page === "assignments" && <AssignmentsPage user={user} courses={data.courses} />}
      {page === "attendance" && <Attendance records={data.attendance} courses={data.courses} user={user} refresh={refresh} />}
      {page === "analytics" && (user.role === "trainer" ? <TrainerReportsPage /> : <AnalyticsPage />)}
      {page === "timetable" && <TimetablePage user={user} courses={data.courses} />}
      {page === "events" && <EventsPage user={user} />}
      {page === "batches" && <BatchesPage courses={data.courses} user={user} />}
      {page === "learningPath" && <LearningPathPage />}
      {page === "assistant" && <AssistantPage />}
      {page === "community" && <CommunityPage user={user} />}
      {page === "gamification" && <GamificationPage />}
      {page === "career" && <CareerPage user={user} courses={data.courses} />}
      {page === "notifications" && <NotificationsPage />}
      {page === "adminUsers" && user.role === "administrator" && <AdminUsersPage />}
      {page === "adminPermissions" && user.role === "administrator" && <AdminPermissionsPage />}
      {page === "adminCourses" && user.role === "administrator" && <AdminCoursesPage />}
      {page === "adminAudit" && user.role === "administrator" && <AdminAuditPage />}
      {page === "apiManagement" && user.role === "administrator" && <AdminApiManagementPage />}
      {page === "adminSettings" && user.role === "administrator" && <AdminSettingsPage />}
      {["placementStudents", "placementCompanies", "placementJobs", "placementDrives", "placementApplications", "placementInterviews", "placementOffers", "placementResources", "placementReports"].includes(page)
        && user.role === "placement_officer" && <PlacementOfficerPage key={page} section={page} setPage={changePage} />}
      {page === "reports" && <ReportsPage />}
      {page === "announcements" && <Announcements notes={data.announcements} courses={data.courses} user={user} refresh={refresh} />}
      {page === "support" && <Support user={user} />}
      {page === "design" && <DesignModel />}
      {page === "profile" && <Profile user={user} updateUser={setUser} />}
    </div>
  </div>;
}
