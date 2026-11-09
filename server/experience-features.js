const text = (id, label, required = true, maxLength = 180) => ({ id, label, type: "text", required, maxLength });
const textarea = (id, label, required = false, maxLength = 1200) => ({ id, label, type: "textarea", required, maxLength });
const date = (id, label, required = false) => ({ id, label, type: "date", required });
const number = (id, label, required = false, max = 1000000) => ({ id, label, type: "number", required, min: 0, max });
const select = (id, label, options, required = true) => ({ id, label, type: "select", required, options });
const url = (id, label, required = false) => ({ id, label, type: "url", required });
const email = (id, label, required = false) => ({ id, label, type: "email", required, maxLength: 180 });
const student = ["student", "administrator"];
const staff = ["trainer", "coordinator", "placement_officer", "administrator"];
const allRoles = ["student", ...staff];
const everyone = { viewRoles: allRoles, createRoles: allRoles, publicListing: false };
const feature = (id, category, title, description, fields, access = {}) => ({
  id, category, title, description, fields,
  viewRoles: access.viewRoles || everyone.viewRoles,
  createRoles: access.createRoles || everyone.createRoles,
  publicListing: access.publicListing ?? false
});

export const experienceFeatures = [
  feature("career-roadmap", "Student Experience & Career", "Career Roadmap Builder", "Choose a goal and map the skills, milestones, and target dates needed to reach it.", [
    text("title", "Career goal"), text("targetRole", "Target role"), textarea("skills", "Skills to build", true, 800),
    textarea("milestones", "Learning milestones", true), date("targetDate", "Target date"), select("status", "Progress", ["Planned", "In progress", "Completed"])
  ], { createRoles: student, viewRoles: ["student", "placement_officer", "administrator"] }),
  feature("digital-portfolio", "Student Experience & Career", "Student Digital Portfolio", "Showcase projects, certificates, skills, and achievements.", [
    text("title", "Portfolio item"), select("itemType", "Type", ["Project", "Certificate", "Skill", "Achievement"]),
    textarea("description", "Description"), url("link", "Project or certificate link")
  ], { createRoles: student, viewRoles: ["student", "placement_officer", "administrator"], publicListing: true }),
  feature("job-application-tracker", "Student Experience & Career", "Job Application Tracker", "Keep a personal record of applications and their latest status.", [
    text("title", "Job or company"), text("role", "Role"), date("appliedOn", "Application date"),
    select("status", "Status", ["Applied", "Shortlisted", "Interview", "Rejected", "Offer"]), textarea("notes", "Notes")
  ], { createRoles: student, viewRoles: ["student", "placement_officer", "administrator"] }),
  feature("peer-skill-exchange", "Student Experience & Career", "Peer Skill Exchange", "Offer a skill to teach or find a student who can help you learn.", [
    text("title", "Skill"), select("exchangeType", "I want to", ["Teach", "Learn", "Teach and learn"]),
    textarea("description", "What you can offer or want to learn"), text("availability", "Availability", false)
  ], { createRoles: student, publicListing: true }),
  feature("campus-ambassadors", "Student Experience & Career", "Campus Ambassador Program", "Register interest and track campus ambassador activity.", [
    text("title", "Application or activity"), textarea("motivation", "Why are you interested?"),
    select("status", "Status", ["Interested", "Applied", "Selected", "Active", "Completed"])
  ], { createRoles: ["student", "coordinator", "administrator"], viewRoles: ["student", "coordinator", "administrator"] }),
  feature("achievement-wall", "Student Experience & Career", "Student Achievement Wall", "Share a milestone, project, award, or accomplishment with the campus.", [
    text("title", "Achievement"), textarea("description", "What did you accomplish?"), date("achievedOn", "Date")
  ], { createRoles: student, publicListing: true }),

  feature("mock-interview-booking", "Career & Employment", "Mock Interview Booking", "Request a practice interview and track its schedule and outcome.", [
    text("title", "Target role"), select("interviewType", "Interview focus", ["Technical", "Behavioral", "HR", "Portfolio"]),
    date("preferredDate", "Preferred date"), text("preferredTime", "Preferred time", false),
    select("status", "Status", ["Requested", "Confirmed", "Completed", "Cancelled"]), textarea("notes", "Preparation notes")
  ], { createRoles: ["student", "placement_officer", "administrator"], viewRoles: ["student", "placement_officer", "administrator"] }),
  feature("recruitment-drives", "Career & Employment", "Recruitment Drive Calendar", "Create or track placement drives, registration deadlines, and participation.", [
    text("title", "Drive or company"), date("date", "Drive date", true), date("deadline", "Registration deadline"),
    text("eligibility", "Eligibility", false), select("status", "Status", ["Upcoming", "Registered", "Attended", "Closed"])
  ], { createRoles: ["student", "placement_officer", "administrator"], viewRoles: ["student", "placement_officer", "administrator"], publicListing: true }),
  feature("referral-connect", "Career & Employment", "Referral Connect", "Ask for or offer a career referral while keeping follow-ups organized.", [
    text("title", "Company and role"), select("requestType", "Referral", ["Request a referral", "Offer a referral"]),
    textarea("message", "Context or message"), select("status", "Status", ["Open", "Connected", "Follow-up", "Closed"])
  ], { createRoles: student, viewRoles: ["student", "placement_officer", "administrator"], publicListing: true }),
  feature("internship-diary", "Career & Employment", "Internship Diary", "Record day-to-day internship work and weekly progress.", [
    text("title", "Internship or weekly update"), date("date", "Entry date", true),
    textarea("workDone", "Work completed", true), textarea("learning", "What I learned"), textarea("blockers", "Blockers")
  ], { createRoles: ["student"], viewRoles: ["student", "placement_officer", "administrator"] }),
  feature("placement-readiness", "Career & Employment", "Placement Readiness Scorecard", "Track preparation across skills, projects, and interview practice.", [
    text("title", "Readiness goal"), number("skillsScore", "Skills progress (%)", false, 100), number("projectsScore", "Projects progress (%)", false, 100),
    number("interviewScore", "Interview preparation (%)", false, 100), textarea("nextSteps", "Next steps")
  ], { createRoles: ["student", "placement_officer", "administrator"], viewRoles: ["student", "placement_officer", "administrator"] }),
  feature("interview-experiences", "Career & Employment", "Interview Experience Library", "Share interview questions and experiences to help other students prepare.", [
    text("title", "Company and role"), text("round", "Interview round", false),
    textarea("questions", "Questions and experience", true), select("difficulty", "Difficulty", ["Beginner", "Intermediate", "Advanced"])
  ], { createRoles: student, viewRoles: ["student", "placement_officer", "administrator"], publicListing: true }),

  feature("weekly-coding-challenge", "Skills & Technology Academy", "Weekly Coding Challenge", "Post a challenge attempt, solution link, and completion status.", [
    text("title", "Challenge"), text("language", "Programming language", false), url("solutionLink", "Solution link"),
    textarea("notes", "Approach or notes"), select("status", "Status", ["Started", "Submitted", "Reviewed"])
  ], { createRoles: ["student", "trainer", "administrator"], publicListing: true }),
  feature("course-progress", "Skills & Technology Academy", "Course Progress Tracker", "Track lesson completion and assessment progress.", [
    text("title", "Course or lesson"), number("completion", "Completion (%)", false, 100), date("updatedOn", "Last updated"),
    textarea("nextSteps", "Next learning steps")
  ], { createRoles: student, viewRoles: ["student", "trainer", "administrator"] }),
  feature("certificate-vault", "Skills & Technology Academy", "Digital Certificate Vault", "Keep a personal index of earned certificates and verification links.", [
    text("title", "Certificate name"), text("issuer", "Issuing organization"), date("earnedOn", "Date earned"),
    url("verificationLink", "Verification link")
  ], { createRoles: student, viewRoles: ["student", "placement_officer", "administrator"] }),
  feature("learning-streaks", "Skills & Technology Academy", "Learning Streak Tracker", "Set a learning goal and record your daily activity.", [
    text("title", "Learning goal"), number("minutes", "Minutes learned"), date("activityDate", "Activity date", true),
    textarea("reflection", "What did you learn?")
  ], { createRoles: student, viewRoles: ["student", "administrator"] }),
  feature("workshop-registration", "Skills & Technology Academy", "Workshop Registration System", "Publish workshops or record your registration and attendance.", [
    text("title", "Workshop"), date("date", "Workshop date", true), text("location", "Location or online link", false),
    select("status", "Status", ["Open", "Registered", "Attended", "Waitlisted", "Cancelled"])
  ], { createRoles: ["student", "trainer", "coordinator", "administrator"], publicListing: true }),
  feature("skill-gap-tracker", "Skills & Technology Academy", "Skill Gap Tracker", "Compare your current skills with a target role and plan what to learn next.", [
    text("title", "Target role"), text("skill", "Skill to develop"), select("currentLevel", "Current level", ["Not started", "Beginner", "Intermediate", "Advanced"]),
    select("targetLevel", "Target level", ["Beginner", "Intermediate", "Advanced"]), textarea("actionPlan", "Learning plan")
  ], { createRoles: student, viewRoles: ["student", "placement_officer", "administrator"] }),

  feature("campus-event-hub", "College & Campus Engagement", "Campus Event Hub", "Create, discover, and track campus events and registrations.", [
    text("title", "Event name"), date("date", "Event date", true), text("location", "Location", false),
    textarea("description", "Event details"), select("status", "Status", ["Draft", "Open for registration", "Registered", "Attended", "Completed"])
  ], { createRoles: ["student", "trainer", "coordinator", "administrator"], publicListing: true }),
  feature("student-clubs", "College & Campus Engagement", "Student Club Management", "Find clubs, record membership interest, or track club activities.", [
    text("title", "Club or activity"), text("activity", "Membership or activity", false),
    textarea("description", "Details"), select("status", "Status", ["Interested", "Member", "Active", "Completed"])
  ], { createRoles: ["student", "coordinator", "administrator"], publicListing: true }),
  feature("campus-elections", "College & Campus Engagement", "Campus Election Portal", "Register candidacy or record election participation.", [
    text("title", "Election or position"), select("participation", "Participation", ["Candidate", "Voter"]),
    textarea("statement", "Candidate statement or notes", false), select("status", "Status", ["Registered", "Approved", "Voting open", "Completed"])
  ], { createRoles: ["student", "coordinator", "administrator"], viewRoles: ["student", "coordinator", "administrator"] }),
  feature("event-volunteers", "College & Campus Engagement", "Event Volunteer Management", "Offer to volunteer or organize volunteer assignments and attendance.", [
    text("title", "Event"), text("assignment", "Volunteer assignment", false), date("date", "Event date"),
    select("status", "Status", ["Available", "Assigned", "Attended", "Completed"])
  ], { createRoles: ["student", "coordinator", "administrator"], publicListing: true }),

  feature("industry-mentor-connect", "Corporate & Startup Connect", "Industry Mentor Connect", "Request an industry mentor session and track follow-ups.", [
    text("title", "Mentor topic or goal"), text("industry", "Industry", false), date("preferredDate", "Preferred date"),
    select("status", "Status", ["Requested", "Scheduled", "Completed", "Follow-up"])
  ], { createRoles: ["student", "placement_officer", "administrator"], viewRoles: ["student", "placement_officer", "administrator"] }),
  feature("corporate-projects", "Corporate & Startup Connect", "Corporate Project Marketplace", "Post a company project or submit your interest in a project.", [
    text("title", "Project"), textarea("description", "Project scope"), text("skills", "Skills needed", false),
    date("deadline", "Application deadline"), select("status", "Status", ["Open", "Applied", "Shortlisted", "In progress", "Completed"])
  ], { createRoles: ["student", "placement_officer", "administrator"], viewRoles: ["student", "placement_officer", "administrator"], publicListing: true }),
  feature("startup-ideas", "Corporate & Startup Connect", "Startup Idea Submission", "Submit an idea and track its review and progress.", [
    text("title", "Startup idea"), textarea("problem", "Problem and proposed solution", true),
    text("team", "Team members", false), select("status", "Status", ["Draft", "Submitted", "Under review", "Selected", "In progress"])
  ], { createRoles: ["student", "administrator"], viewRoles: ["student", "administrator"] }),
  feature("innovation-challenges", "Corporate & Startup Connect", "Innovation Challenge Portal", "Create a challenge or submit a solution for evaluation.", [
    text("title", "Challenge or submission"), textarea("description", "Challenge details or solution", true),
    url("submissionLink", "Submission link"), select("status", "Status", ["Open", "Submitted", "Under evaluation", "Selected", "Completed"])
  ], { createRoles: ["student", "trainer", "coordinator", "administrator"], publicListing: true }),
  feature("mentor-matching", "Corporate & Startup Connect", "Mentor Matching System", "Share mentorship goals or mentor availability for a potential match.", [
    text("title", "Mentorship goal or expertise"), select("matchType", "I am a", ["Founder seeking a mentor", "Mentor offering support"]),
    text("industry", "Industry", false), textarea("description", "Areas of support or experience")
  ], { createRoles: ["student", "placement_officer", "administrator"], viewRoles: ["student", "placement_officer", "administrator"], publicListing: true }),
  feature("investor-connect", "Corporate & Startup Connect", "Investor Connect Tracker", "Track startup investor meetings, follow-ups, and next steps.", [
    text("title", "Investor or meeting"), date("meetingDate", "Meeting date"), textarea("notes", "Discussion notes"),
    date("followUpDate", "Follow-up date"), select("status", "Status", ["Planned", "Met", "Follow-up", "Closed"])
  ], { createRoles: ["student", "administrator"], viewRoles: ["student", "administrator"] }),

  feature("service-requests", "Business Services & Operations", "Service Request Tracker", "Submit a website, app development, or digital marketing request and follow its status.", [
    text("title", "Request title"), select("service", "Service", ["Website", "App development", "Digital marketing", "Other"]),
    textarea("requirements", "Requirements", true), select("status", "Status", ["New", "Reviewing", "In progress", "Completed", "Closed"])
  ], { createRoles: ["student", "trainer", "coordinator", "placement_officer", "administrator"], viewRoles: allRoles }),
  feature("lead-management", "Business Services & Operations", "Lead Management Dashboard", "Capture enquiries, follow-ups, and client status.", [
    text("title", "Enquiry or client"), text("contact", "Contact name", false), email("email", "Contact email"),
    date("followUpDate", "Follow-up date"), textarea("notes", "Enquiry notes"),
    select("status", "Status", ["New enquiry", "Contacted", "Follow-up", "Qualified", "Won", "Closed"])
  ], { createRoles: ["placement_officer", "administrator"], viewRoles: ["placement_officer", "administrator"] })
];

export function getExperienceFeature(featureId) {
  return experienceFeatures.find((item) => item.id === featureId);
}

export function validateExperienceFields(featureDefinition, input) {
  if (!featureDefinition || !input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Choose a valid feature and provide its form fields." };
  }
  const allowedFields = new Set(featureDefinition.fields.map((field) => field.id));
  if (Object.keys(input).some((key) => !allowedFields.has(key))) {
    return { error: "The form contains an unsupported field." };
  }

  const fields = {};
  for (const definition of featureDefinition.fields) {
    const rawValue = input[definition.id];
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      if (definition.required) return { error: `${definition.label} is required.` };
      continue;
    }
    if (definition.type === "number") {
      const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
      if (!Number.isFinite(value) || value < definition.min || value > definition.max) {
        return { error: `${definition.label} must be a number from ${definition.min} to ${definition.max}.` };
      }
      fields[definition.id] = value;
      continue;
    }
    if (typeof rawValue !== "string" || !rawValue.trim()) {
      return { error: `${definition.label} must be text.` };
    }
    const value = rawValue.trim();
    if (definition.type === "select" && !definition.options.includes(value)) {
      return { error: `Choose a valid option for ${definition.label}.` };
    }
    if (definition.maxLength && value.length > definition.maxLength) {
      return { error: `${definition.label} must be ${definition.maxLength} characters or fewer.` };
    }
    if (definition.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value)
      || Number.isNaN(Date.parse(`${value}T00:00:00Z`))
      || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) {
      return { error: `${definition.label} must be a valid date.` };
    }
    if (definition.type === "url") {
      try {
        if (new URL(value).protocol !== "https:") throw new Error("HTTPS required");
      } catch {
        return { error: `${definition.label} must be a valid HTTPS URL.` };
      }
    }
    if (definition.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { error: `${definition.label} must be a valid email address.` };
    }
    fields[definition.id] = value;
  }
  return { fields };
}
