const question = (prompt, correct, ...incorrect) => ({ prompt, correct, incorrect });
const codeQuestion = (prompt, language, code, correct, ...incorrect) => ({
  prompt,
  correct,
  incorrect,
  language,
  code
});
const assessment = (title, questions) => ({ title, questions });
const courses = {
  "c-1": { title: "Frontend Development with React", introduction: "Learn to build accessible, responsive web interfaces from HTML and CSS foundations through interactive React applications, testing and a finished portfolio project." },
  "c-2": { title: "Backend APIs with Node.js", introduction: "Start with Node.js and Express, then build validated REST APIs backed by MongoDB, protect them with authentication and authorization, and test a production-ready service." },
  "c-3": { title: "SQL & Database Engineering", introduction: "Progress from relational tables and SQL queries through joins, schema design and transactions, then connect MongoDB and databases to application features." },
  "c-4": { title: "Artificial Intelligence Fundamentals", introduction: "Explore how intelligent agents search and make decisions, learn the foundations of machine learning and neural networks, and design AI features responsibly." },
  "c-5": { title: "Machine Learning Foundations", introduction: "Follow a practical Python machine-learning workflow: frame a prediction, inspect and prepare data, train models, evaluate results, and present a reproducible project." },
  "c-6": { title: "Full-Stack Web Development", introduction: "Build a complete web application step by step, from responsive frontend and React through APIs, authentication, databases, testing and deployment." },
  "c-7": { title: "Data Structures & Algorithms", introduction: "Develop problem-solving skills from complexity and arrays to collections, trees, graphs and dynamic programming, with practice explaining tested solutions." },
  "c-8": { title: "Java Programming & OOP", introduction: "Learn Java syntax and control flow, design object-oriented programs, work with collections and exceptions, and finish with a tested Java application." },
  "c-9": { title: "Python for AI & Data Science", introduction: "Build Python skills, work with real tabular data using pandas, and prepare a clear, reproducible starter machine-learning project." }
};
const topicGuides = [
  [/semantic|html|document structure/i, "Use meaningful HTML elements to describe page structure and content. Semantic landmarks help browsers and assistive technologies understand the page and make it easier to maintain."],
  [/css selectors|box model|flexbox|grid|responsive|mobile-first/i, "Learn how CSS controls layout and adapts a page to different screen sizes. Practice choosing flexible sizing and layout rules rather than relying on fixed dimensions."],
  [/accessibility|keyboard|forms|programmatic label/i, "Make the interface usable with keyboards and assistive technology. Use semantic controls, clear labels, visible focus and helpful validation rather than relying on color or placeholders alone."],
  [/javascript|variables|values|operators/i, "Learn how JavaScript represents data, stores values and evaluates expressions. Choose clear declarations and use the right value types to make program behavior predictable."],
  [/function|parameters|return values|scope/i, "Break a program into reusable functions with clear inputs and return values. Understand scope so each piece of logic is easier to test and reuse."],
  [/array|list|object|dictionary|map|set|tuple|collection/i, "Choose a data structure that fits the problem, then practice reading, updating and iterating over its values. Consider ordering, uniqueness and lookup needs."],
  [/dom|event|browser api|form handling/i, "Connect browser events to useful interface behavior. Read user input, update the page deliberately and provide feedback when an action succeeds or fails."],
  [/promise|fetch|async|error handling/i, "Handle asynchronous work without freezing the interface. Model loading, success and failure states explicitly, and report request errors rather than assuming a request succeeded."],
  [/jsx|react component|props|component composition/i, "Build reusable React components with clear responsibilities. Pass data through props and compose smaller interface pieces into a complete page."],
  [/state|hooks|effects/i, "Use React state for values that change on screen and hooks for component behavior. Keep derived values simple and reserve effects for synchronization with external systems."],
  [/lists, keys|stable.*key|conditional rendering/i, "Render collections with stable keys so React can track items across updates. Use conditional rendering to show the right state without hiding important feedback."],
  [/testing|test cases|edge cases|unit test|integration test|end-to-end/i, "Write focused tests for expected behavior, invalid input and important edge cases. Integration tests should verify that connected parts work together."],
  [/production build|deployment|performance|portfolio|present|readme/i, "Prepare a finished project for other people to use: build it, explain setup, check key user flows and describe design choices and limitations."],
  [/node\.js|runtime|npm/i, "Understand how Node.js runs JavaScript outside the browser and how npm manages project scripts and dependencies. Keep runtime configuration explicit."],
  [/module|environment variable|package|dependency/i, "Organize code into reusable modules and configure applications through environment settings. Keep credentials out of source code and frontend bundles."],
  [/http|request|response lifecycle|status code|json/i, "Trace how an HTTP request reaches a server and how a response communicates its result. Choose appropriate methods, JSON shapes and status codes."],
  [/express|middleware|routing|route handler/i, "Use Express routes to handle application resources and middleware for shared request processing. Keep handlers clear about validation, access and responses."],
  [/rest|resource-oriented|api contract|endpoint/i, "Design predictable resource-oriented API routes and methods. Define request and response shapes so clients can use the service consistently."],
  [/validation|malformed|input/i, "Validate untrusted input on the server before using it. Return an actionable client error for invalid values and never treat client-side checks as a security boundary."],
  [/pagination|filtering|documentation/i, "Let API consumers request bounded, filtered data and document the available inputs and response shape. This makes large datasets easier and safer to use."],
  [/mongodb|document|collection|bson|crud/i, "Work with MongoDB documents and collections, query by fields and perform create, read, update and delete operations. Choose document shapes that suit the application's access patterns."],
  [/index|query plan|performance/i, "Use indexes to support frequent query patterns, then consider their storage and write costs. Measure query behavior rather than adding indexes without a reason."],
  [/persistence|transaction|consistency|normalization|foreign key|relationship/i, "Model related records so data remains consistent as it changes. Understand constraints and transactions, and verify saved data survives a restart."],
  [/sql|relational|table|row|column|primary key|select|where|join|group|aggregate|null/i, "Use relational tables and SQL to retrieve and summarize related data. Select only needed columns, filter intentionally and represent relationships with appropriate keys."],
  [/authentication|authorization|ownership|credential|secret/i, "Authenticate the person making a request, then authorize the specific action and resource on the server. Protect credentials and do not rely on hidden frontend controls."],
  [/search|breadth-first|depth-first|heuristic|graph/i, "Represent the problem as states and connections, then choose a search strategy that fits. Track visited states and explain how the algorithm moves toward a goal."],
  [/agent|decision|action|goal/i, "Describe what an agent can observe, which actions it may take and what goal it should reach. Consider constraints and whether a person must review its decisions."],
  [/machine learning|prediction|feature|label|supervised|unsupervised|baseline|model/i, "Frame a prediction task with a clear target and appropriate inputs. Train a model against a simple baseline, then evaluate it on data kept separate from training."],
  [/neural network|neuron|layer|weight|activation/i, "Understand how layers transform inputs using learned weights and activation functions. Training adjusts those parameters; evaluation checks whether the model generalizes."],
  [/data|dataset|missing|duplicate|outlier|preprocess|train\/test|leakage|csv|pandas|dataframe/i, "Inspect data types, missing values and quality before modeling. Split examples carefully, learn preprocessing only from training data and avoid letting evaluation information leak into training."],
  [/statistics|distribution|summary|metric|accuracy|precision|recall|confusion|error analysis|overfitting|generalization/i, "Evaluate results with metrics suited to the task, inspect mistakes and check for overfitting. A score summarizes behavior; it does not guarantee fairness or future performance."],
  [/bias|fairness|privacy|consent|data minimization|human oversight|safety|limitation|uncertainty/i, "Assess how data and model errors could affect people. Minimize personal data, explain uncertainty, check relevant groups and keep appropriate human oversight."],
  [/python|notebook|script|indentation|comprehension/i, "Write readable Python in small steps, using its standard data structures and consistent indentation. Use a notebook or script to make the analysis easy to reproduce."],
  [/java|jdk|primitive|reference|control flow|constructor|class|object|inheritance|polymorphism|encapsulation|composition/i, "Use Java's types, classes and methods to model program behavior. Apply object-oriented principles to keep responsibilities clear and state controlled."],
  [/exception|resource handling|context manager|stream|lambda/i, "Handle failures explicitly and release files or other resources reliably. Use collection transformations where they make the program clearer, not merely shorter."],
  [/big o|complexity|invariant|binary search|sorting|stack|queue|linked list|tree|heap|recursion|memoization|dynamic programming|shortest path/i, "Choose an algorithm and data structure that suit the input, explain why it is correct and estimate its time and space cost. Test boundary cases before trusting the result."],
  [/visualization|visualize|chart|communicate/i, "Choose a clear visualization that answers a specific question. Label it honestly, show relevant context and avoid visual choices that hide uncertainty or distort comparisons."]
];
const explainTopic = (topic, moduleTitle) => topicGuides.find(([pattern]) => pattern.test(topic))?.[1]
  || `Learn the core ideas behind ${topic.toLowerCase()}, when this approach is useful and common pitfalls to avoid. Connect it to ${moduleTitle.toLowerCase()} and practice explaining your choices before starting the assignment.`;
const codeChallenges = {
  "c-1": [
    codeQuestion("What does this render, and why?", "jsx", `const prices = [10, 20, 30];\nconst eligible = prices.filter((price) => price >= 20);\nconsole.log(eligible.length);`, "2", "3", "1", "undefined"),
    codeQuestion("What value is logged after the click handler runs once?", "jsx", `function Counter() {\n  const [count, setCount] = useState(0);\n  function incrementTwice() {\n    setCount(count + 1);\n    setCount(count + 1);\n  }\n  return <button onClick={incrementTwice}>{count}</button>;\n}`, "1, because both updates use the same captured state", "2, because every setter increments independently", "0, because state cannot change in an event", "The component throws because a handler cannot update state"),
    codeQuestion("Which issue can cause React to reuse the wrong row state after this update?", "jsx", `items.map((item, index) => (\n  <EditableRow key={index} item={item} />\n))`, "Index keys can attach existing row state to a different item after reordering", "React always rejects numeric keys", "Every row remounts because item is passed as a prop", "The array cannot be rendered with map"),
    codeQuestion("What is the main problem with the effect below?", "jsx", `useEffect(() => {\n  setTotal(items.reduce((sum, item) => sum + item.price, 0));\n}, [items, total]);`, "It updates derived state and depends on that state, which can cause extra renders", "Effects cannot read arrays", "The dependency array must always be empty", "A reducer can only run inside an event handler")
  ],
  "c-2": [
    codeQuestion("What is logged when the promise resolves?", "js", `async function loadIds() {\n  return [4, 7];\n}\nloadIds().then((ids) => console.log(ids.length));`, "2", "1", "undefined", "A Promise object"),
    codeQuestion("What should the route return if the service rejects?", "js", `app.get("/reports", async (req, res, next) => {\n  const report = await reportService.load();\n  res.json(report);\n});`, "Pass the error to Express error handling, for example with try/catch and next(error)", "Return HTTP 200 with an empty report", "Ignore the rejection and leave the request open", "Send the error stack to the client"),
    codeQuestion("Which check prevents the invalid value from being stored?", "js", `app.post("/users", async (req, res) => {\n  const age = Number(req.body.age);\n  await users.insertOne({ age });\n  res.sendStatus(201);\n});`, "Validate that age is an integer within the allowed range before insertOne", "Convert age to a number, which is sufficient validation", "Return 201 before writing to MongoDB", "Move the validation into the frontend only"),
    codeQuestion("What is the access-control flaw in this route?", "js", `app.delete("/documents/:id", requireLogin, async (req, res) => {\n  await documents.deleteOne({ _id: req.params.id });\n  res.sendStatus(204);\n});`, "It authenticates the user but never checks permission to delete that document", "DELETE routes must always return a JSON body", "A route cannot use a path parameter", "Authentication makes the delete public")
  ],
  "c-3": [
    codeQuestion("How many rows can this query return for a course with no enrollments?", "sql", `SELECT c.id, COUNT(e.student_id)\nFROM courses c\nLEFT JOIN enrollments e ON e.course_id = c.id\nGROUP BY c.id;`, "One row for the course with a count of zero", "No row, because LEFT JOIN removes unmatched courses", "One row for every possible student", "A syntax error because COUNT cannot follow LEFT JOIN"),
    codeQuestion("Why might this grouped query be invalid in standard SQL?", "sql", `SELECT department, student_name, COUNT(*)\nFROM enrollments\nGROUP BY department;`, "student_name is neither grouped nor aggregated", "COUNT cannot be used with GROUP BY", "department must be an integer", "GROUP BY must always contain every table column"),
    codeQuestion("What does the placeholder protect against?", "sql", `const result = await db.query(\n  "SELECT id FROM users WHERE email = ?",\n  [email]\n);`, "Treating the email as a value instead of executable SQL syntax", "Making the email unique automatically", "Encrypting the database connection", "Creating an index on email"),
    codeQuestion("What is the trade-off of adding this index?", "sql", `CREATE INDEX enrollments_course_date\nON enrollments(course_id, created_at);`, "Reads filtering by course_id and ordering by created_at may improve, while writes/storage cost more", "Every query becomes constant time", "Rows are automatically sorted permanently", "The index enforces uniqueness on both columns")
  ],
  "c-4": [
    codeQuestion("After breadth-first search expands A, which node is visited next?", "text", `A -> [B, C]\nB -> [D]\nC -> [E]\nQueue after expanding A: [B, C]`, "B", "C", "D", "E"),
    codeQuestion("Why can this search return a non-shortest path?", "python", `def search(node):\n    if is_goal(node):\n        return [node]\n    for child in children(node):\n        result = search(child)\n        if result:\n            return [node] + result`, "Depth-first search may find a deep goal before a shorter path", "It always explores every path in breadth-first order", "It cannot test for a goal", "Recursion guarantees the shortest path"),
    codeQuestion("What is a limitation of the output from this model call?", "python", `prediction = model.predict(features)\nprint(prediction[0])`, "A prediction alone does not communicate uncertainty or evaluation limits", "predict always returns the training labels", "The call proves the model is fair", "The output cannot be a class label"),
    codeQuestion("What should be checked before using this feature in a high-impact decision?", "python", `decision = model.predict(applicant_features)\nif decision[0] == 1:\n    approve_application()`, "Evaluate group outcomes and add appropriate human oversight and recourse", "Increase the number of hidden features without testing", "Assume the prediction is an objective fact", "Remove monitoring after deployment")
  ],
  "c-5": [
    codeQuestion("What is the target leakage risk in this workflow?", "python", `X_scaled = scaler.fit_transform(X)\nX_train, X_test, y_train, y_test = train_test_split(\n    X_scaled, y, test_size=0.2, random_state=7\n)`, "The scaler learns statistics from the test rows before the split", "The random seed prevents reproducibility", "Scaling cannot be used with numeric features", "The split creates the target from X"),
    codeQuestion("What is wrong with fitting preprocessing this way before cross-validation?", "python", `X_encoded = encoder.fit_transform(X)\nscores = cross_val_score(model, X_encoded, y, cv=5)`, "Each validation fold can influence encoder-fitted preprocessing; use a pipeline inside cross-validation", "Cross-validation only supports regression", "Encoders must always be fitted on the target", "A pipeline would expose the test labels"),
    codeQuestion("Which conclusion is justified by this code?", "python", `baseline = DummyClassifier(strategy="most_frequent")\nbaseline.fit(X_train, y_train)\nprint(baseline.score(X_test, y_test))`, "It gives a reference score to compare with a trained model on the same held-out split", "It proves the production model is fair", "It measures performance on future data with certainty", "It can replace evaluation metrics for every class"),
    codeQuestion("Why is this evaluation risky for an imbalanced dataset?", "python", `accuracy = (y_pred == y_test).mean()\nprint(accuracy)`, "High accuracy can hide poor recall on a rare but important class", "Accuracy is undefined for classification", "The expression trains the model on y_test", "Class imbalance always improves accuracy")
  ],
  "c-6": [
    codeQuestion("What is the likely effect of this CSS on a narrow screen?", "css", `.cards {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 16px;\n}`, "Three columns may become cramped; use responsive columns such as minmax and auto-fit", "CSS Grid automatically changes every 3 columns to 1", "The cards become inaccessible because grid is used", "The gap disables wrapping"),
    codeQuestion("What user-visible behavior is missing if this request rejects?", "jsx", `async function save() {\n  setSaving(true);\n  await api("/api/profile", { method: "PUT", body });\n  setSaving(false);\n}`, "A catch/finally path to show an error and reliably clear the saving state", "A second PUT request", "A page reload on every error", "A client-side password check"),
    codeQuestion("Which security issue remains even if the button is hidden for students?", "js", `if (user.role === "admin") {\n  return <button onClick={() => api("/api/users/delete", { method: "DELETE" })}>Delete</button>;\n}`, "The server must still authorize the delete request", "React never renders conditionally", "A DELETE request cannot include a route", "Buttons cannot trigger API calls"),
    codeQuestion("What is the strongest reason to place preprocessing in this pipeline?", "python", `pipeline = make_pipeline(\n    SimpleImputer(),\n    StandardScaler(),\n    LogisticRegression()\n)\npipeline.fit(X_train, y_train)`, "Each fitted preprocessing step learns only from the training data in that fit", "It guarantees the model has no bias", "It removes the need for a held-out test set", "It forces every feature to be normally distributed")
  ],
  "c-7": [
    codeQuestion("What is the worst-case time complexity of this nested loop?", "js", `for (const left of values) {\n  for (const right of values) {\n    compare(left, right);\n  }\n}`, "O(n²)", "O(n log n)", "O(n)", "O(log n)"),
    codeQuestion("What does this function return for [2, 7, 2, 9]?", "js", `function firstRepeated(values) {\n  const seen = new Set();\n  for (const value of values) {\n    if (seen.has(value)) return value;\n    seen.add(value);\n  }\n  return null;\n}`, "2", "7", "9", "null"),
    codeQuestion("Why is this recursive traversal unsafe for a cyclic graph?", "js", `function visit(node) {\n  for (const next of node.neighbors) visit(next);\n}`, "It needs a visited set to avoid revisiting nodes indefinitely", "Graphs cannot have neighbors", "Recursion automatically sorts neighbors", "It only works on arrays"),
    codeQuestion("What is the time complexity of retrieving the memoized result after it has been computed?", "js", `function fib(n, memo = {}) {\n  if (n < 2) return n;\n  if (memo[n] !== undefined) return memo[n];\n  return memo[n] = fib(n - 1, memo) + fib(n - 2, memo);\n}`, "O(1) lookup for that cached state, with O(n) distinct states overall", "O(2^n) for every cached lookup", "O(n²) storage for one state", "O(log n) distinct states")
  ],
  "c-8": [
    codeQuestion("What does this program print?", "java", `List<Integer> scores = List.of(50, 80, 90);\nlong passed = scores.stream().filter(score -> score >= 80).count();\nSystem.out.println(passed);`, "2", "3", "1", "It does not compile because count returns an int"),
    codeQuestion("What happens when this method is called with a negative amount?", "java", `class Wallet {\n  public int balance;\n  void withdraw(int amount) { balance -= amount; }\n}`, "The public state and missing validation allow the balance to become invalid", "Java blocks every negative argument automatically", "The balance is immutable", "The method throws for every subtraction"),
    codeQuestion("Which concept allows this call to select the overridden subclass implementation?", "java", `Shape shape = new Circle();\nSystem.out.println(shape.area());`, "Runtime polymorphism through method overriding", "Constructor chaining only", "Primitive widening", "Static import"),
    codeQuestion("What risk does this resource-handling pattern have?", "java", `FileInputStream input = new FileInputStream(path);\nreadAll(input);\ninput.close();`, "If readAll throws, close may never run; use try-with-resources", "Streams cannot read files", "close always runs automatically", "The path must be an integer")
  ],
  "c-9": [
    codeQuestion("What is the value of `result`?", "python", `values = [3, 8, 11, 14]\nresult = [value // 2 for value in values if value % 2 == 0]\nprint(result)`, "[4, 7]", "[1, 4, 5, 7]", "[8, 14]", "[]"),
    codeQuestion("What value does this function return for an empty list?", "python", `def average(values):\n    return sum(values) / len(values)`, "It raises ZeroDivisionError", "0", "None", "An empty list"),
    codeQuestion("Which leakage occurs in this data-preparation code?", "python", `df["mean_income"] = df.groupby("region")["income"].transform("mean")\ntrain, test = train_test_split(df, test_size=0.2)`, "Group statistics are calculated before splitting, so test rows influence training features", "The split is stratified automatically", "Mean imputation is impossible with pandas", "The code removes the target column"),
    codeQuestion("Why can this chart be misleading when categories are unbalanced?", "python", `rates = df.groupby("group")["approved"].mean()\nprint(rates)`, "A mean alone hides group sizes and uncertainty; report counts and context too", "Group means cannot be calculated", "Pandas sorts categories by approval rate", "The expression proves a causal effect")
  ]
};
const moduleData = (courseId, order, title, topics, assignment) => ({
  id: `module-${courseId}-${order}`,
  courseId,
  order,
  weeks: `${(order - 1) * 2 + 1}-${order * 2}`,
  title,
  topics: topics.map((topic, index) => ({
    id: `module-${courseId}-${order}-topic-${index + 1}`,
    title: topic,
    explanation: explainTopic(topic, title),
    videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${courses[courseId].title} ${topic} tutorial`)}`
  })),
  assignment: {
    ...assignment,
    questions: [...assignment.questions, codeChallenges[courseId][order - 1]]
  }
});

export const courseModules = [
  moduleData("c-1", 1, "Web foundations & responsive design", ["Semantic HTML and page structure", "CSS selectors, box model, Flexbox and Grid", "Responsive layouts and mobile-first design", "Accessibility, forms and browser tools"], assessment("Responsive profile page", [
    question("Which HTML element identifies a page's main navigation?", "<nav>", "<span>", "<b>", "<aside>"),
    question("Which CSS tool arranges items in two dimensions?", "CSS Grid", "Float", "Text-align", "Static positioning"),
    question("What is a useful responsive design starting point?", "Design mobile-first and add breakpoints", "Fix every width at 1200px", "Remove keyboard focus", "Render all text as images"),
    question("What should a form control have?", "A programmatic label", "A placeholder as its only name", "A color-only instruction", "No keyboard support")
  ])),
  moduleData("c-1", 2, "JavaScript & browser programming", ["Variables, values and operators", "Functions, arrays, objects and iteration", "DOM events and form handling", "Promises, fetch and error handling"], assessment("Interactive browser feature", [
    question("Which declaration can be reassigned within its block?", "let", "const", "import", "class"),
    question("What does addEventListener enable?", "Responding to browser events", "Creating database indexes", "Compiling CSS", "Changing server ports"),
    question("How should a rejected fetch request be handled?", "Catch it and show a useful state", "Assume it succeeded", "Retry without limit", "Hide all feedback"),
    question("What does JSON.parse convert?", "JSON text into a JavaScript value", "CSS into HTML", "An image into a URL", "A promise into a database")
  ])),
  moduleData("c-1", 3, "React components & application state", ["JSX, components and props", "State, events and hooks", "Lists, keys and conditional rendering", "Forms, effects and component composition"], assessment("Build a reusable React interface", [
    question("What are props primarily used for?", "Passing inputs from a parent component", "Persisting database records", "Styling the browser", "Installing packages"),
    question("Which hook stores changing component state?", "useState", "useEffect", "useId", "useMemo"),
    question("Why should list items have stable keys?", "So React can track items between renders", "To encrypt each item", "To add a stylesheet", "To submit a form"),
    question("When should an effect usually run?", "To synchronize with an external system", "For every derived value", "To replace all event handlers", "To declare component props")
  ])),
  moduleData("c-1", 4, "Testing & frontend portfolio project", ["Accessible interaction patterns", "Reusable component architecture", "Testing UI behavior and edge cases", "Production builds, performance and project presentation"], assessment("Accessible course dashboard", [
    question("What should a UI test primarily verify?", "Observable user behavior", "Private implementation details only", "The author's color preference", "The number of source files"),
    question("What makes an icon-only button accessible?", "An accessible name", "A larger border radius", "A hidden click handler", "A random identifier"),
    question("What belongs before sharing a production build?", "Build and test key user flows", "Remove error handling", "Expose environment secrets", "Delete setup instructions"),
    question("Why split an interface into reusable components?", "To organize and reuse UI behavior", "To bypass input validation", "To expose credentials", "To prevent responsive layouts")
  ])),

  moduleData("c-2", 1, "Node.js & server fundamentals", ["JavaScript runtime and npm", "Modules, environment variables and scripts", "HTTP request and response lifecycle", "Express middleware and routing"], assessment("Create a small Express service", [
    question("What is Node.js used for?", "Running JavaScript on the server", "Styling HTML elements", "Querying CSS selectors", "Replacing HTTP"),
    question("What is Express middleware commonly used for?", "Processing requests before route handlers", "Drawing browser graphics", "Creating indexes automatically", "Installing an operating system"),
    question("Where should a private service credential be stored?", "A server-side environment secret", "A public frontend file", "A query-string URL", "A screenshot"),
    question("What does an Express route handler do?", "Responds to a matching request", "Compiles browser styles", "Creates a local user account", "Replaces a database")
  ])),
  moduleData("c-2", 2, "REST APIs & input validation", ["Resource-oriented URL design", "HTTP methods, status codes and JSON", "Request validation and useful errors", "Pagination, filtering and API documentation"], assessment("Design a validated REST endpoint", [
    question("Which HTTP method is normally used to create a resource?", "POST", "GET", "HEAD", "OPTIONS"),
    question("What should an API do with malformed input?", "Validate it and return a client error", "Persist it anyway", "Return a stack trace", "Silently claim success"),
    question("What does HTTP 404 normally indicate?", "The requested resource was not found", "The resource was created", "The user is authenticated", "The server is starting"),
    question("Why paginate a large API result?", "To return manageable portions of data", "To disable authorization", "To expose every database record", "To avoid validating input")
  ])),
  moduleData("c-2", 3, "MongoDB, persistence & data modeling", ["Documents, collections and BSON", "CRUD operations and query filters", "Schema validation and useful indexes", "Configuration and persistence tests"], assessment("Persist API records safely", [
    question("In MongoDB, a collection groups what?", "Documents", "CSS rules", "HTTP headers", "JavaScript packages"),
    question("Why index a frequently queried field?", "To help matching queries find records efficiently", "To encrypt the database", "To validate passwords", "To change response formats"),
    question("Which operation updates a matching MongoDB document?", "updateOne", "listen", "render", "compile"),
    question("What should a persistence test verify?", "Data remains available after restarting the API", "The page has a particular color", "A request always succeeds", "No database is used")
  ])),
  moduleData("c-2", 4, "API security, testing & deployment", ["Authentication and role-based authorization", "Ownership checks and safe errors", "Unit and integration test cases", "Production configuration and deployment readiness"], assessment("Secure and test a backend API", [
    question("What is authorization responsible for?", "Checking what an authenticated user may do", "Parsing CSS", "Backing up a database", "Choosing a port"),
    question("What should tests for a protected endpoint include?", "Success, invalid input and role-denial cases", "Only a screenshot", "Only a successful admin request", "No tests"),
    question("What is a safe unexpected-error response?", "A useful generic message without secrets", "The full environment", "A database password", "An unhandled stack trace"),
    question("What should deployment configuration keep private?", "Credentials and signing secrets", "Public route names", "HTML labels", "Non-sensitive status codes")
  ])),

  moduleData("c-3", 1, "Relational data & SQL foundations", ["Tables, rows, columns and primary keys", "SELECT, WHERE, ORDER BY and LIMIT", "INSERT, UPDATE and DELETE", "NULL values and parameterized queries"], assessment("Query a relational dataset", [
    question("Which SQL clause filters rows?", "WHERE", "ORDER BY", "LIMIT", "CREATE"),
    question("What does a primary key identify?", "A row uniquely within its table", "A CSS selector", "A database password", "A query plan"),
    question("How should application queries pass user values?", "Using parameterized placeholders", "Concatenating raw input", "Putting values in CSS", "Disabling validation"),
    question("What does NULL represent in SQL?", "A missing or unknown value", "The number zero", "An empty table", "A unique index")
  ])),
  moduleData("c-3", 2, "Joins, aggregation & reporting", ["INNER and LEFT JOIN", "GROUP BY and aggregate functions", "HAVING, subqueries and common table expressions", "Readable reports and result interpretation"], assessment("Create a course enrollment report", [
    question("Which SQL operation combines related table rows?", "JOIN", "SORT", "RENAME", "LIMIT"),
    question("Which clause filters grouped aggregate results?", "HAVING", "WHERE", "FROM", "VALUES"),
    question("Which function counts rows in a group?", "COUNT", "LOWER", "ROUND", "COALESCE"),
    question("What does a LEFT JOIN retain?", "Every row from the left table", "Only unrelated right rows", "Only duplicate columns", "No unmatched records")
  ])),
  moduleData("c-3", 3, "Schema design, transactions & performance", ["Relationships and normalization", "Foreign keys and integrity constraints", "Transactions and consistency", "Indexes and reading query plans"], assessment("Model a reliable application schema", [
    question("What is a foreign key used for?", "Connecting a row to a related table row", "Encrypting a query", "Sorting text", "Replacing every primary key"),
    question("What does a transaction help ensure?", "Related writes succeed or fail consistently", "Every query has an index", "Every report is correct", "A table has no columns"),
    question("What is a common index trade-off?", "Faster reads can require storage and write work", "Indexes remove backup needs", "Indexes validate all input", "Indexes replace transactions"),
    question("What does normalization generally reduce?", "Unnecessary duplication and update anomalies", "The need for primary keys", "The number of valid queries", "Data consistency")
  ])),
  moduleData("c-3", 4, "MongoDB & application integration", ["Documents, collections and embedded data", "MongoDB filters and CRUD operations", "Choosing relational or document models", "Connecting APIs to persistent data"], assessment("Connect a database-backed feature", [
    question("MongoDB stores records primarily as what?", "Documents", "HTML pages", "CSV headers", "CSS declarations"),
    question("When is a relational database often a good fit?", "Data has clear relationships and transaction constraints", "Every record is unrelated text", "The application has no data", "Only images need display"),
    question("What should an app do if a database write fails?", "Report failure and avoid claiming success", "Return success anyway", "Discard the error silently", "Expose credentials"),
    question("Why create an application database index?", "To support common query patterns efficiently", "To hide all data", "To replace validation", "To delete old records")
  ])),

  moduleData("c-4", 1, "AI concepts, agents & search", ["AI problem formulation: states, actions and goals", "Breadth-first and depth-first search", "Heuristics and informed search", "Agent decisions, constraints and use cases"], assessment("Plan a search-based solution", [
    question("What defines a basic search problem?", "States, actions and a goal", "A stylesheet and font", "A database password", "A chart title"),
    question("Which strategy explores the shallowest frontier first?", "Breadth-first search", "Depth-first search", "Random search", "Binary insertion"),
    question("What does a heuristic estimate?", "How close a state may be to a goal", "A user's password", "The number of CSS files", "The server port"),
    question("What is an AI agent designed to do?", "Observe its context and choose actions toward a goal", "Only store images", "Compile HTML", "Replace every human decision")
  ])),
  moduleData("c-4", 2, "Machine learning & neural network basics", ["Data, features, labels and prediction", "Supervised and unsupervised learning", "Neurons, layers, weights and activation", "Training, validation and inference"], assessment("Explain an AI model workflow", [
    question("What guides supervised model training?", "Examples paired with known labels", "Only a CSS theme", "Server port names", "An unlabelled button"),
    question("What do neural network weights represent?", "Learned parameters that influence predictions", "Database table names", "Page margins", "Browser history"),
    question("Why keep evaluation examples separate?", "To estimate behavior on unseen data", "To guarantee zero errors", "To make the model memorize more", "To avoid a prediction target"),
    question("What is inference?", "Using a trained model to produce a prediction", "Deleting training data", "Writing a database index", "Sorting source files")
  ])),
  moduleData("c-4", 3, "Responsible AI, privacy & evaluation", ["Bias, fairness and representative data", "Privacy, consent and data minimization", "Reliability, uncertainty and human oversight", "Safety, accessibility and impact assessment"], assessment("Review an AI use case responsibly", [
    question("What is a useful first fairness check?", "Evaluate outcomes across relevant groups", "Hide evaluation data", "Assume training data is perfect", "Remove human review"),
    question("What does data minimization mean?", "Collect only data needed for a clear purpose", "Collect every available record", "Publish personal records", "Keep data forever"),
    question("When is human oversight especially important?", "When decisions can meaningfully affect people", "Never", "Only after deleting logs", "Only for decorative text"),
    question("What should an AI evaluation include?", "Representative examples and relevant limitations", "Only one favorable example", "No error analysis", "A claim of perfect fairness")
  ])),
  moduleData("c-4", 4, "Build & present an intelligent application", ["Select an appropriate AI approach", "Prepare inputs and evaluate outputs", "Design human-friendly controls and explanations", "Document limitations and present a prototype"], assessment("Prototype an AI-assisted feature", [
    question("What should an AI feature communicate when uncertain?", "Useful uncertainty and limitations", "A guarantee it is always correct", "A hidden data source", "Nothing to the user"),
    question("Which evaluation approach is more trustworthy?", "Representative held-out examples and relevant metrics", "One favorable example", "No testing", "Only the best result"),
    question("What belongs in a responsible AI presentation?", "Purpose, evaluation, limitations and safeguards", "Only a model name", "Private credentials", "An unsupported accuracy claim"),
    question("What should a human-centered AI interface provide?", "Clear controls and understandable feedback", "Hidden decisions with no recourse", "Unlabeled buttons", "Unexplained personal-data collection")
  ])),

  moduleData("c-5", 1, "Python, statistics & ML problem framing", ["Python notebooks, variables and functions", "Prediction targets, features and labels", "Data types, distributions and summary statistics", "Baselines, assumptions and problem statements"], assessment("Frame a prediction problem", [
    question("What is a prediction target?", "The outcome a model is intended to estimate", "A CSS property", "A database host", "A chart color"),
    question("Why create a simple baseline?", "To judge whether a complex model adds value", "To hide all errors", "To eliminate test data", "To guarantee fairness"),
    question("Which Python structure stores ordered values?", "list", "HTTP status", "CSS grid", "database index"),
    question("What is a feature?", "An input variable used to make a prediction", "The final evaluation score only", "A server password", "A chart border")
  ])),
  moduleData("c-5", 2, "Data inspection & preprocessing", ["Load and inspect tabular datasets", "Handle missing values, duplicates and outliers", "Encode categories and scale features", "Split data and prevent leakage"], assessment("Prepare a clean training dataset", [
    question("When should a test split be created?", "Before fitting transformations or selecting a model", "After tuning on all test results", "Only after deployment", "Never"),
    question("What is data leakage?", "Evaluation information improperly influencing training", "A chart without a legend", "A missing button", "A short model name"),
    question("Where should preprocessing parameters be learned?", "On training data, then applied to held-out data", "On test labels", "Using future outcomes", "Without a data split"),
    question("What should be done with missing values?", "Inspect them and choose a justified treatment", "Always replace them with zero", "Hide them from every report", "Delete the whole dataset")
  ])),
  moduleData("c-5", 3, "Supervised models & feature engineering", ["Regression and classification", "Linear models, trees and nearest neighbors", "Feature selection and transformation", "Cross-validation and model comparison"], assessment("Train a supervised model", [
    question("Which task predicts a numeric quantity such as price?", "Regression", "Classification", "Sorting", "Clustering only"),
    question("What does cross-validation help estimate?", "Performance variation across data splits", "The API port", "Password strength", "Image size"),
    question("Why select or engineer useful features?", "To provide informative model inputs", "To guarantee no bias", "To replace evaluation", "To remove the target"),
    question("What does a classification model predict?", "A category or class", "A guaranteed causal effect", "A file path only", "A database schema")
  ])),
  moduleData("c-5", 4, "Model evaluation & prediction capstone", ["Accuracy, precision, recall and regression metrics", "Confusion matrices and error analysis", "Overfitting, generalization and limitations", "Reproducible model pipeline and project presentation"], assessment("Evaluate and present an ML project", [
    question("When can accuracy be misleading?", "When classes are imbalanced or error costs differ", "When a model has a name", "When data is in CSV", "Never"),
    question("What is overfitting?", "Learning training-specific patterns that generalize poorly", "A model with too few files", "A clean test split", "A database index"),
    question("What should an ML report include?", "Metrics, data splits, errors and limitations", "Only the highest score", "Private data rows", "A guarantee of future performance"),
    question("Why inspect prediction errors?", "To understand failure patterns and model limitations", "To discard the test set", "To hide weak results", "To avoid choosing metrics")
  ])),

  moduleData("c-6", 1, "HTML, CSS & JavaScript foundations", ["Semantic document structure", "Responsive CSS and design systems", "JavaScript events and browser APIs", "Forms, validation and accessibility"], assessment("Build a responsive frontend", [
    question("Which practice improves keyboard accessibility?", "Keep a visible focus indicator", "Remove all focus styles", "Use color as the only label", "Make controls unreachable"),
    question("What does client-side validation provide?", "Fast feedback alongside server validation", "A replacement for server security", "Guaranteed trusted data", "Automatic backups"),
    question("What adapts layouts to different screen widths?", "Flexible layouts and responsive breakpoints", "Fixed width for every screen", "A database trigger", "An HTTP redirect"),
    question("What does semantic HTML improve?", "Meaningful structure for browsers and assistive technology", "Database query speed", "Server authentication", "Image compression")
  ])),
  moduleData("c-6", 2, "React & frontend application architecture", ["Components, props and reusable UI", "State, hooks and event handling", "Routing, forms and async loading states", "Accessible component and page composition"], assessment("Create a multi-page React experience", [
    question("Why split a frontend into reusable components?", "To organize and reuse interface behavior", "To bypass validation", "To expose secrets", "To disable responsive layouts"),
    question("What should a page display while data loads?", "A clear loading state", "A false success result", "An empty error object", "A password prompt"),
    question("How should React identify each list item?", "With a stable unique key", "With a new random value every render", "With a hidden password", "With no identifier"),
    question("How should failed requests appear to users?", "As a clear error with a recovery path", "As an invented success", "As a blank screen", "As leaked server details")
  ])),
  moduleData("c-6", 3, "APIs, authentication & databases", ["REST API contracts and JSON", "Server validation and role checks", "Database schemas, CRUD and indexes", "Frontend API integration and error states"], assessment("Connect a full-stack feature", [
    question("Where must authorization be enforced?", "On the server for each protected operation", "Only by hiding a frontend button", "Only in CSS", "In the page title"),
    question("What should a UI do after a failed API request?", "Show a useful error and allow recovery", "Pretend it succeeded", "Erase all user data", "Retry without limit"),
    question("Why validate input on the server?", "A client can send arbitrary requests", "It improves font rendering", "It removes tests", "It makes secrets public"),
    question("What does a database index support?", "Efficient lookup for common query patterns", "Automatic authentication", "Responsive page layout", "Client-side form labels")
  ])),
  moduleData("c-6", 4, "Testing, deployment & full-stack capstone", ["End-to-end user journeys and integration tests", "Production builds and environment configuration", "Monitoring, errors and security review", "Deploy and present a complete application"], assessment("Ship a production-ready web app", [
    question("Where should deployment secrets be stored?", "Server or hosting environment secret settings", "Bundled frontend code", "A public repository", "A query parameter"),
    question("What can a production build check catch?", "Compilation and bundling problems before release", "Every future product decision", "All possible user errors", "Network outages permanently"),
    question("What makes an end-to-end test valuable?", "It verifies a realistic integrated user journey", "It checks only a color token", "It replaces security controls", "It reveals passwords"),
    question("What should a deployment check confirm?", "The app starts and key user flows work", "That credentials are public", "That errors are hidden", "That tests are removed")
  ])),

  moduleData("c-7", 1, "Complexity, arrays & strings", ["Big O time and space complexity", "Array traversal and invariants", "String operations and frequency counts", "Linear and binary search"], assessment("Analyze array and string solutions", [
    question("What does O(n) time usually mean?", "Work grows linearly with input size", "One operation always", "Unlimited memory", "Input is sorted"),
    question("What requirement does binary search have?", "The search range must be ordered", "Strings only", "A database connection", "A graph cycle"),
    question("Why state an algorithm invariant?", "To explain what remains true during each step", "To name a CSS class", "To create a package", "To hide complexity"),
    question("What does a frequency map help count?", "Occurrences of values or characters", "Server uptime", "Image dimensions", "CSS declarations")
  ])),
  moduleData("c-7", 2, "Hash maps, stacks, queues & linked lists", ["Hash maps and sets", "Stack and queue operations", "Linked list traversal and updates", "Choosing structures for common problems"], assessment("Select a data structure", [
    question("Which structure provides last-in, first-out behavior?", "Stack", "Queue", "Hash table", "Graph"),
    question("Which structure provides first-in, first-out behavior?", "Queue", "Stack", "Set", "Tree"),
    question("What is a common use for a hash map?", "Average-case lookup by key", "Automatic sorting", "Graph coloring", "Guaranteed constant worst-case time"),
    question("What does a linked-list node typically store?", "A value and a link to another node", "Only a CSS selector", "An HTTP response", "A database password")
  ])),
  moduleData("c-7", 3, "Recursion, sorting & tree algorithms", ["Recursive and base cases", "Sorting algorithms and trade-offs", "Binary trees and traversal orders", "Heaps and priority queues"], assessment("Implement and compare algorithms", [
    question("What prevents a recursive function continuing indefinitely?", "A correct base case", "A larger font", "A database index", "An extra import"),
    question("Which traversal visits a binary search tree in sorted order?", "In-order traversal", "Random traversal", "Reverse HTTP", "CSS inheritance"),
    question("What is a common heap advantage?", "Efficient access to the highest- or lowest-priority item", "Constant search for every arbitrary key", "Automatic graph coloring", "No memory use"),
    question("What should guide a sorting algorithm choice?", "Input constraints and time/space trade-offs", "The variable name only", "The browser theme", "Whether the code has comments")
  ])),
  moduleData("c-7", 4, "Graphs, dynamic programming & interview practice", ["Graph representations and BFS/DFS", "Shortest paths and connectivity", "Dynamic programming and memoization", "Complexity analysis, tests and explanations"], assessment("Solve a multi-step algorithm problem", [
    question("Which traversal explores a graph layer by layer?", "BFS", "DFS", "Insertion sort", "Hash encoding"),
    question("What does memoization do?", "Stores results of repeated subproblems", "Deletes the input", "Sorts graph edges", "Renames a function"),
    question("What should an algorithm explanation include?", "Approach, correctness reasoning and complexity", "Only final code", "A random benchmark", "No edge cases"),
    question("What is a graph edge?", "A relationship connecting vertices", "A recursive base case", "An array index", "A sorting metric")
  ])),

  moduleData("c-8", 1, "Java syntax, types & control flow", ["JDK, source files and program entry point", "Primitive and reference types", "Conditionals, loops and methods", "Arrays, strings and debugging"], assessment("Write a Java command-line program", [
    question("Which keyword declares a Java class?", "class", "define", "object", "module"),
    question("Which keyword declares a method returning no value?", "void", "null", "empty", "package"),
    question("What does a for loop commonly provide?", "Repeated execution with iteration control", "Database persistence", "HTML semantics", "Authentication"),
    question("Which type represents a true/false value?", "boolean", "String", "double", "char[]")
  ])),
  moduleData("c-8", 2, "Object-oriented programming", ["Classes, objects and constructors", "Encapsulation and access modifiers", "Inheritance, interfaces and polymorphism", "Composition and responsibility-focused design"], assessment("Model a small Java domain", [
    question("What does encapsulation encourage?", "Controlling state through a clear API", "Making every field public", "Removing every method", "Embedding credentials"),
    question("Which keyword declares that one Java class extends another?", "extends", "inherits", "instanceof", "package"),
    question("What is composition?", "Building an object from collaborating objects", "Copying every class into one file", "A loop condition", "A primitive type"),
    question("What does polymorphism allow?", "Different implementations behind a shared type", "Only one class in a program", "Public access to every field", "Removing interfaces")
  ])),
  moduleData("c-8", 3, "Collections, generics & exceptions", ["List, Set, Map and collection selection", "Generics and type safety", "Exceptions and resource handling", "Streams, lambdas and readable transformations"], assessment("Process data with Java collections", [
    question("Which collection enforces unique elements?", "Set", "List", "String", "Array"),
    question("What do Java generics primarily improve?", "Compile-time type safety for reusable code", "Network speed", "Database encryption", "HTML rendering"),
    question("How should recoverable exceptions be handled?", "Clearly or propagated appropriately", "Silently ignored always", "By printing secrets", "By claiming failure succeeded"),
    question("What does a Map store?", "Key-value associations", "Only unique values without keys", "A sequence of CSS rules", "Network packets")
  ])),
  moduleData("c-8", 4, "Testing, persistence & Java project", ["Unit tests and boundary cases", "Packages, build tools and dependencies", "Database/API integration fundamentals", "Build, document and present an application"], assessment("Deliver a tested Java application", [
    question("What is a unit test intended to verify?", "A focused behavior in isolation", "Every production network at once", "Browser history", "The IDE color"),
    question("What should a validator test include?", "Valid, invalid and boundary values", "One perfect input only", "A real secret key", "No assertions"),
    question("What belongs in a project README?", "Setup, run instructions and key usage details", "Private passwords", "Unverified promises", "Access tokens"),
    question("Why write integration tests?", "To verify connected parts work together", "To remove all unit tests", "To publish credentials", "To replace input validation")
  ])),

  moduleData("c-9", 1, "Python essentials & problem solving", ["Python scripts and notebooks", "Variables, strings, numbers and collections", "Conditions, loops and readable expressions", "Input, output and basic debugging"], assessment("Create a Python utility", [
    question("Which keyword defines a Python function?", "def", "func", "function", "method"),
    question("Which built-in type stores key-value pairs?", "dict", "list", "set", "str"),
    question("What does a Python list provide?", "An ordered, mutable collection", "An immutable database table", "A network socket", "A CSS selector"),
    question("How does Python mark an indented code block?", "Consistent indentation", "Curly braces only", "HTML tags", "A semicolon after every line")
  ])),
  moduleData("c-9", 2, "Functions, data structures & modules", ["Parameters, return values and scope", "Lists, tuples, dictionaries and sets", "Comprehensions and reusable modules", "Exceptions, files and CSV data"], assessment("Build reusable Python data tools", [
    question("What does a return statement do?", "Sends a result back to its caller", "Starts an interpreter", "Creates a CSS rule", "Deletes all local variables"),
    question("Which built-in collection stores unique values?", "set", "list", "tuple", "str"),
    question("Why use a context manager when opening a file?", "It helps close the resource reliably", "It sorts every row", "It encrypts the filename", "It replaces error handling"),
    question("What is a Python module?", "A reusable Python file or namespace", "A database row", "A CSS selector", "An HTTP method")
  ])),
  moduleData("c-9", 3, "Data analysis with pandas & visualization", ["Load and inspect tabular data", "Filter, transform, group and summarize records", "Handle missing values and data quality", "Choose clear visualizations and explain findings"], assessment("Explore and communicate a dataset", [
    question("What is a pandas DataFrame?", "A labeled two-dimensional data structure", "A web server", "A Java interface", "An image format"),
    question("What should be checked before interpreting a dataset?", "Missing values, duplicates and data types", "Only the file name", "The author's color preference", "The chart border"),
    question("What makes a visualization useful?", "It communicates a relevant pattern clearly and honestly", "It always uses 3D effects", "It hides uncertainty", "It omits labels"),
    question("What does groupby support in pandas?", "Summarizing records by category", "Starting a web server", "Creating an HTML form", "Encrypting a file")
  ])),
  moduleData("c-9", 4, "Machine learning preparation & capstone", ["Features, labels and a prediction target", "Train/test splits and preprocessing", "Baseline models and relevant metrics", "Present a reproducible notebook and limitations"], assessment("Prepare a Python ML mini-project", [
    question("Why keep test data separate from training?", "To evaluate on examples the model did not learn from", "To increase leakage", "To make every answer correct", "To avoid defining features"),
    question("What should a baseline model provide?", "A simple reference score for comparison", "A guarantee of fairness", "A replacement for test data", "A production password"),
    question("What should a project report say about a model?", "Its data, metrics, errors and limitations", "Only its best prediction", "That it can never fail", "Nothing about evaluation"),
    question("Which practice reduces ML data leakage?", "Fit preprocessing only on training data", "Tune on the test set", "Use future labels", "Duplicate test rows into training")
  ]))
];

export const courseIntroductions = courses;

for (const courseId of new Set(courseModules.map((item) => item.courseId))) {
  const modules = courseModules.filter((item) => item.courseId === courseId);
  if (modules.length !== 4 || modules.some((item, index) => item.order !== index + 1 || item.assignment.questions.length !== 5)) {
    throw new Error(`Invalid course curriculum for ${courseId}`);
  }
  for (const module of modules) {
    for (const [index, item] of module.assignment.questions.entries()) {
      const options = [...item.incorrect];
      const answer = (index + module.order + Number(courseId.slice(2))) % 4;
      options.splice(answer, 0, item.correct);
      module.assignment.questions[index] = {
        prompt: item.prompt,
        options,
        answer,
        ...(item.code ? { code: item.code, language: item.language } : {})
      };
    }
  }
}