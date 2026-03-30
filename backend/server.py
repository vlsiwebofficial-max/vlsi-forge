from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Cookie
from fastapi.responses import StreamingResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import logging
import asyncio
import re
import base64
import io
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import subprocess
import tempfile
import shutil
import httpx
import bcrypt
import jwt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

# Rate limiter (keyed by IP)
limiter = Limiter(key_func=get_remote_address)

# Create the main app
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class DifficultyLevel(str, Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"
    VERY_HARD = "Very Hard"

class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"

class SubmissionStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"

# User Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: EmailStr
    name: str
    picture: Optional[str] = None
    role: UserRole = UserRole.USER
    created_at: datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

# Problem Models
class Testcase(BaseModel):
    testcase_id: str
    input_data: str
    expected_output: str
    is_hidden: bool = False

class Problem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    problem_id: str
    title: str
    description: str
    difficulty: DifficultyLevel
    tags: List[str]
    constraints: str
    starter_code: str
    testbench_template: str
    testcases: List[Testcase]
    created_by: str
    created_at: datetime
    updated_at: datetime

class ProblemCreate(BaseModel):
    title: str
    description: str
    difficulty: DifficultyLevel
    tags: List[str]
    constraints: str
    starter_code: str
    testbench_template: str

class ProblemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    tags: Optional[List[str]] = None
    constraints: Optional[str] = None
    starter_code: Optional[str] = None
    testbench_template: Optional[str] = None

# Submission Models
class SubmissionCreate(BaseModel):
    problem_id: str
    code: str
    testbench: Optional[str] = None
    language: Optional[str] = "verilog"  # "verilog" or "systemverilog"

class TestcaseResult(BaseModel):
    testcase_id: str
    passed: bool
    output: Optional[str] = None
    error: Optional[str] = None

class Submission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    submission_id: str
    user_id: str
    problem_id: str
    code: str
    testbench: Optional[str] = None
    status: SubmissionStatus
    testcase_results: List[TestcaseResult] = []
    passed_count: int = 0
    total_count: int = 0
    compilation_error: Optional[str] = None
    lint_warnings: Optional[List[str]] = None
    vcd_data: Optional[str] = None      # base64-encoded VCD content (replaces file path)
    waveform_json: Optional[Dict] = None  # parsed waveform for browser rendering
    submitted_at: datetime

class TestcaseCreate(BaseModel):
    problem_id: str
    input_data: str
    expected_output: str
    is_hidden: bool = False

class UserStats(BaseModel):
    total_solved: int
    easy_solved: int
    medium_solved: int
    hard_solved: int
    total_submissions: int
    accuracy: float

class HintRequest(BaseModel):
    code: str
    error: Optional[str] = None


# ==================== STARTUP / INDEXES ====================

@app.on_event("startup")
async def create_indexes():
    """Create MongoDB indexes for performance"""
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.problems.create_index("problem_id", unique=True)
        await db.problems.create_index([("difficulty", 1), ("tags", 1)])
        await db.submissions.create_index("submission_id", unique=True)
        await db.submissions.create_index([("user_id", 1), ("submitted_at", -1)])
        await db.submissions.create_index([("problem_id", 1), ("status", 1)])
        # TTL index: auto-delete expired sessions
        await db.user_sessions.create_index("session_token")
        await db.user_sessions.create_index(
            "expires_at",
            expireAfterSeconds=0  # MongoDB removes docs when expires_at < now
        )
        logger.info("MongoDB indexes created successfully")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ==================== SECURITY — DANGEROUS CODE DETECTION ====================

# Patterns that could abuse the simulation environment
DANGEROUS_PATTERNS = [
    (r'\$system\s*\(', "Use of $system() is not allowed"),
    (r'\$fopen\s*\([^)]*["\'][wWaA+]', "Write-mode $fopen is not allowed"),
    (r'\$fwrite\b', "$fwrite is not allowed"),
    (r'\$fdisplay\b', "$fdisplay is not allowed"),
    (r'`include\s+["\']/', "Absolute path includes are not allowed"),
    (r'\$readmemh\s*\(["\'][/~]', "Absolute path $readmemh is not allowed"),
    (r'\$readmemb\s*\(["\'][/~]', "Absolute path $readmemb is not allowed"),
]

def check_dangerous_code(code: str) -> Optional[str]:
    """
    Scan submitted Verilog/SV for dangerous constructs.
    Returns an error string if found, None if safe.

    NOTE: This is a defense-in-depth measure. The production system should
    also run simulations inside a Docker container with --network none.
    """
    for pattern, message in DANGEROUS_PATTERNS:
        if re.search(pattern, code, re.IGNORECASE):
            return f"Security violation: {message}"
    return None


# ==================== OUTPUT NORMALIZATION ====================

def normalize_sim_output(raw: str) -> str:
    """
    Normalize simulation output for comparison.
    Handles whitespace, hex/decimal variants, and VCD noise.
    """
    lines = []
    for line in raw.strip().splitlines():
        line = line.strip()
        # Drop blank lines and pure comment lines
        if not line or line.startswith("//") or line.startswith("VCD"):
            continue
        # Normalize hex literals: 0xFF -> 255, 8'hFF -> 255
        line = re.sub(
            r"\b(\d+)'[hH]([0-9a-fA-F]+)\b",
            lambda m: str(int(m.group(2), 16)),
            line
        )
        line = re.sub(
            r"\b0[xX]([0-9a-fA-F]+)\b",
            lambda m: str(int(m.group(1), 16)),
            line
        )
        lines.append(line.lower())
    return "\n".join(lines)


# ==================== VCD PARSER — BROWSER WAVEFORM ====================

def parse_vcd_to_json(vcd_content: str) -> Dict:
    """
    Parse VCD file into a JSON structure suitable for browser rendering.
    Returns: { signals: {name: [(time, value), ...]}, max_time: int, timescale: str }
    """
    signals: Dict[str, list] = {}
    id_to_name: Dict[str, str] = {}
    id_to_width: Dict[str, int] = {}
    current_time = 0
    timescale = "1ns"
    in_dumpvars = False

    for line in vcd_content.splitlines():
        line = line.strip()
        if not line:
            continue

        if line.startswith("$timescale"):
            # $timescale 1ns $end  or multi-line
            ts_match = re.search(r'\$timescale\s+(.+?)\s*\$end', vcd_content, re.DOTALL)
            if ts_match:
                timescale = ts_match.group(1).strip()
            continue

        if line.startswith("$var"):
            # $var wire 8 ! signal_name $end
            parts = line.split()
            if len(parts) >= 5:
                width = int(parts[2]) if parts[2].isdigit() else 1
                var_id = parts[3]
                var_name = parts[4].rstrip("$end").strip()
                id_to_name[var_id] = var_name
                id_to_width[var_id] = width
                signals[var_name] = []
            continue

        if line.startswith("#"):
            try:
                current_time = int(line[1:])
            except ValueError:
                pass
            continue

        if line.startswith("$dumpvars"):
            in_dumpvars = True
            continue

        if line.startswith("$end"):
            in_dumpvars = False
            continue

        # Scalar value change: 0! or 1! or x!
        if len(line) >= 2 and line[0] in "01xzXZ":
            value = line[0]
            var_id = line[1:]
            if var_id in id_to_name:
                signals[id_to_name[var_id]].append([current_time, value])
            continue

        # Vector value change: b1010 ! or B1010 !
        if line.startswith(("b", "B", "r", "R")):
            parts = line.split()
            if len(parts) == 2:
                value = parts[0][1:]  # strip leading b/B/r/R
                var_id = parts[1]
                if var_id in id_to_name:
                    # Convert binary to int for display
                    try:
                        int_val = int(value.replace("x", "0").replace("z", "0"), 2)
                        signals[id_to_name[var_id]].append([current_time, str(int_val)])
                    except ValueError:
                        signals[id_to_name[var_id]].append([current_time, value])

    return {
        "signals": signals,
        "max_time": current_time,
        "timescale": timescale
    }


# ==================== ASYNC SIMULATION ENGINE ====================

async def run_command_async(cmd: List[str], cwd: str, timeout: float = 10) -> tuple:
    """Run a subprocess asynchronously without blocking the event loop."""
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return proc.returncode, stdout.decode("utf-8", errors="replace"), stderr.decode("utf-8", errors="replace")
    except asyncio.TimeoutError:
        try:
            proc.kill()
            await proc.communicate()
        except Exception:
            pass
        raise


async def compile_and_simulate_verilog(code: str, testbench: str, language: str = "verilog") -> dict:
    """
    Compile and simulate Verilog/SystemVerilog code using Icarus Verilog.

    Key fixes vs original:
    - Fully async (no event loop blocking)
    - VCD stored as base64 string, not file path
    - Waveform parsed into JSON for browser rendering
    - Temp dir always cleaned up in finally block
    - SystemVerilog supported via -g2012 flag
    - Verilator lint run after successful compilation
    """
    temp_dir = tempfile.mkdtemp()
    logger.info(f"Starting simulation in {temp_dir} (lang={language})")

    try:
        design_file = Path(temp_dir) / "design.v"
        testbench_file = Path(temp_dir) / "testbench.v"
        vcd_file = Path(temp_dir) / "waveform.vcd"
        compiled_file = Path(temp_dir) / "simulation.vvp"

        design_file.write_text(code)
        testbench_file.write_text(testbench)

        # Build iverilog command — add -g2012 for SystemVerilog support
        iverilog_cmd = ["iverilog"]
        if language == "systemverilog":
            iverilog_cmd += ["-g2012"]
        iverilog_cmd += ["-o", str(compiled_file), str(design_file), str(testbench_file)]

        # ── Step 1: Compile ──────────────────────────────────────────
        try:
            rc, stdout, stderr = await run_command_async(iverilog_cmd, temp_dir, timeout=15)
        except asyncio.TimeoutError:
            return {"success": False, "error": "Compilation timeout (15s limit)", "output": None,
                    "vcd_data": None, "waveform_json": None, "lint_warnings": []}

        if rc != 0:
            error_msg = stderr or stdout or "Compilation failed"
            logger.error(f"Compilation error: {error_msg[:500]}")
            return {"success": False, "error": error_msg, "output": None,
                    "vcd_data": None, "waveform_json": None, "lint_warnings": []}

        # ── Step 2: Simulate ─────────────────────────────────────────
        try:
            rc, sim_stdout, sim_stderr = await run_command_async(
                ["vvp", str(compiled_file)], temp_dir, timeout=10
            )
        except asyncio.TimeoutError:
            return {"success": False, "error": "Simulation timeout (10s limit). Check for infinite loops.",
                    "output": None, "vcd_data": None, "waveform_json": None, "lint_warnings": []}

        logger.info(f"Simulation done (rc={rc}), stdout={len(sim_stdout)} chars")

        # ── Step 3: Read VCD as base64 ───────────────────────────────
        vcd_data = None
        waveform_json = None
        if vcd_file.exists():
            raw_vcd = vcd_file.read_text(errors="replace")
            vcd_data = base64.b64encode(raw_vcd.encode()).decode()
            try:
                waveform_json = parse_vcd_to_json(raw_vcd)
            except Exception as e:
                logger.warning(f"VCD parse error: {e}")

        # ── Step 4: Verilator Lint (best-effort) ─────────────────────
        lint_warnings = []
        try:
            lint_rc, lint_out, lint_err = await run_command_async(
                ["verilator", "--lint-only", "-Wall", "--bbox-unsup", str(design_file)],
                temp_dir, timeout=8
            )
            lint_text = lint_err or lint_out
            for line in lint_text.splitlines():
                if "Warning" in line or "Error" in line:
                    # Strip temp dir path from messages
                    clean = line.replace(str(temp_dir) + "/", "")
                    lint_warnings.append(clean.strip())
        except (FileNotFoundError, asyncio.TimeoutError):
            # verilator not installed or timed out — skip silently
            pass
        except Exception as e:
            logger.debug(f"Lint skipped: {e}")

        return {
            "success": True,
            "error": None,
            "output": sim_stdout,
            "stderr": sim_stderr,
            "vcd_data": vcd_data,
            "waveform_json": waveform_json,
            "lint_warnings": lint_warnings
        }

    finally:
        # Always clean up temp directory — no leaks
        shutil.rmtree(temp_dir, ignore_errors=True)


# ==================== AUTHENTICATION ====================

async def get_user_from_session(request: Request) -> Optional[User]:
    """Extract user from session_token cookie or Authorization header"""
    session_token = request.cookies.get("session_token")

    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")

    if not session_token:
        return None

    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )

    if not session_doc:
        return None

    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < datetime.now(timezone.utc):
        # Clean up expired session
        await db.user_sessions.delete_one({"session_token": session_token})
        return None

    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )

    if not user_doc:
        return None

    if isinstance(user_doc["created_at"], str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])

    return User(**user_doc)


async def require_auth(request: Request) -> User:
    user = await get_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_admin(request: Request) -> User:
    user = await require_auth(request)
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = bcrypt.hashpw(user_data.password.encode(), bcrypt.gensalt())
    user_id = f"user_{uuid.uuid4().hex[:12]}"

    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hashed_password.decode(),
        "role": UserRole.USER.value,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.users.insert_one(user_doc)

    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "session_id": f"sess_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.user_sessions.insert_one(session_doc)

    response = JSONResponse(content={
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": UserRole.USER.value
    })

    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60, path="/"
    )
    return response


@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc or "password_hash" not in user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not bcrypt.checkpw(credentials.password.encode(), user_doc["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "session_id": f"sess_{uuid.uuid4().hex[:12]}",
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.user_sessions.insert_one(session_doc)

    response = JSONResponse(content={
        "user_id": user_doc["user_id"],
        "email": user_doc["email"],
        "name": user_doc["name"],
        "role": user_doc["role"],
        "picture": user_doc.get("picture")
    })

    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60, path="/"
    )
    return response


@api_router.post("/auth/google/session")
async def google_auth_session(request: Request):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")

    async with httpx.AsyncClient() as http_client:
        response = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session ID")
        google_data = response.json()

    existing_user = await db.users.find_one({"email": google_data["email"]}, {"_id": 0})

    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": google_data["name"], "picture": google_data["picture"]}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": google_data["email"],
            "name": google_data["name"],
            "picture": google_data["picture"],
            "role": UserRole.USER.value,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    session_token = google_data["session_token"]
    await db.user_sessions.insert_one({
        "session_id": f"sess_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    user_data = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    response = JSONResponse(content={
        "user_id": user_data["user_id"],
        "email": user_data["email"],
        "name": user_data["name"],
        "role": user_data["role"],
        "picture": user_data.get("picture")
    })
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none",
        max_age=7 * 24 * 60 * 60, path="/"
    )
    return response


@api_router.get("/auth/me")
async def get_current_user(request: Request):
    user = await require_auth(request)
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}


# ==================== PROBLEM ROUTES ====================

def _coerce_problem_dates(problem: dict) -> dict:
    for key in ("created_at", "updated_at"):
        if isinstance(problem.get(key), str):
            problem[key] = datetime.fromisoformat(problem[key])
    return problem


@api_router.get("/problems")
async def get_problems(
    request: Request,
    difficulty: Optional[str] = None,
    tag: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    query: dict = {}
    if difficulty:
        query["difficulty"] = difficulty
    if tag:
        query["tags"] = tag

    problems = await db.problems.find(query, {"_id": 0, "testcases": 0}).skip(skip).limit(limit).to_list(limit)
    return [_coerce_problem_dates(p) for p in problems]


@api_router.get("/problems/{problem_id}")
async def get_problem(problem_id: str):
    problem = await db.problems.find_one({"problem_id": problem_id}, {"_id": 0})
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    return _coerce_problem_dates(problem)


@api_router.post("/problems")
async def create_problem(request: Request, problem_data: ProblemCreate):
    user = await require_admin(request)
    problem_id = f"prob_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    problem_doc = {
        "problem_id": problem_id,
        **problem_data.model_dump(),
        "difficulty": problem_data.difficulty.value,
        "testcases": [],
        "created_by": user.user_id,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    await db.problems.insert_one(problem_doc)
    problem_doc["created_at"] = now
    problem_doc["updated_at"] = now
    return problem_doc


@api_router.put("/problems/{problem_id}")
async def update_problem(request: Request, problem_id: str, problem_data: ProblemUpdate):
    await require_admin(request)
    existing = await db.problems.find_one({"problem_id": problem_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Problem not found")

    update_data = {k: v for k, v in problem_data.model_dump().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.problems.update_one({"problem_id": problem_id}, {"$set": update_data})

    updated = await db.problems.find_one({"problem_id": problem_id}, {"_id": 0})
    return _coerce_problem_dates(updated)


@api_router.delete("/problems/{problem_id}")
async def delete_problem(request: Request, problem_id: str):
    await require_admin(request)
    result = await db.problems.delete_one({"problem_id": problem_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Problem not found")
    return {"message": "Problem deleted successfully"}


# ==================== TESTCASE ROUTES ====================

@api_router.post("/testcases")
async def create_testcase(request: Request, testcase_data: TestcaseCreate):
    await require_admin(request)
    problem = await db.problems.find_one({"problem_id": testcase_data.problem_id})
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    testcase = {
        "testcase_id": f"tc_{uuid.uuid4().hex[:8]}",
        "input_data": testcase_data.input_data,
        "expected_output": testcase_data.expected_output,
        "is_hidden": testcase_data.is_hidden
    }
    await db.problems.update_one(
        {"problem_id": testcase_data.problem_id},
        {"$push": {"testcases": testcase}}
    )
    return testcase


@api_router.delete("/testcases/{problem_id}/{testcase_id}")
async def delete_testcase(request: Request, problem_id: str, testcase_id: str):
    await require_admin(request)
    result = await db.problems.update_one(
        {"problem_id": problem_id},
        {"$pull": {"testcases": {"testcase_id": testcase_id}}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Testcase not found")
    return {"message": "Testcase deleted successfully"}


# ==================== SUBMISSION ROUTES ====================
# IMPORTANT: /submissions/user/me MUST come before /submissions/{submission_id}
# to prevent "user" matching the {submission_id} parameter.

@api_router.get("/submissions/user/me")
async def get_user_submissions(request: Request, limit: int = 50, skip: int = 0):
    """Get current user's submissions — paginated, most recent first."""
    user = await require_auth(request)
    limit = min(limit, 200)  # hard cap

    submissions = await db.submissions.find(
        {"user_id": user.user_id},
        {"_id": 0, "vcd_data": 0, "waveform_json": 0}  # exclude heavy binary fields
    ).sort("submitted_at", -1).skip(skip).limit(limit).to_list(limit)

    for s in submissions:
        if isinstance(s.get("submitted_at"), str):
            s["submitted_at"] = datetime.fromisoformat(s["submitted_at"])

    return submissions


@api_router.post("/submissions")
@limiter.limit("10/minute")  # max 10 submissions per minute per IP
async def submit_code(request: Request, submission_data: SubmissionCreate):
    """Submit code for evaluation."""
    user = await require_auth(request)
    logger.info(f"Submission from {user.user_id} for problem {submission_data.problem_id}")

    # ── Security check ────────────────────────────────────────────────
    danger = check_dangerous_code(submission_data.code)
    if danger:
        raise HTTPException(status_code=400, detail=danger)
    if submission_data.testbench:
        danger = check_dangerous_code(submission_data.testbench)
        if danger:
            raise HTTPException(status_code=400, detail=danger)

    problem = await db.problems.find_one({"problem_id": submission_data.problem_id}, {"_id": 0})
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    submission_id = f"sub_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    language = submission_data.language or "verilog"
    use_custom_testbench = bool(submission_data.testbench and submission_data.testbench.strip())

    submission_doc = {
        "submission_id": submission_id,
        "user_id": user.user_id,
        "problem_id": submission_data.problem_id,
        "code": submission_data.code,
        "testbench": submission_data.testbench,
        "language": language,
        "status": SubmissionStatus.PROCESSING.value,
        "testcase_results": [],
        "passed_count": 0,
        "total_count": 1 if use_custom_testbench else len(problem["testcases"]),
        "compilation_error": None,
        "lint_warnings": [],
        "vcd_data": None,
        "waveform_json": None,
        "submitted_at": now.isoformat()
    }
    await db.submissions.insert_one(submission_doc)

    testcase_results = []
    passed_count = 0
    compilation_error = None
    vcd_data = None
    waveform_json = None
    lint_warnings = []

    if use_custom_testbench:
        # ── Custom testbench mode ─────────────────────────────────────
        result = await compile_and_simulate_verilog(
            submission_data.code, submission_data.testbench, language
        )
        lint_warnings = result.get("lint_warnings", [])

        if not result["success"]:
            compilation_error = result["error"]
            testcase_results.append({
                "testcase_id": "custom_testbench",
                "passed": False,
                "output": result.get("output"),
                "error": result["error"]
            })
        else:
            testcase_results.append({
                "testcase_id": "custom_testbench",
                "passed": True,
                "output": result["output"],
                "error": None
            })
            passed_count = 1
            vcd_data = result["vcd_data"]
            waveform_json = result["waveform_json"]
    else:
        # ── Problem testcase mode ─────────────────────────────────────
        logger.info(f"Running {len(problem['testcases'])} testcases")
        for idx, testcase in enumerate(problem["testcases"]):
            tb = problem["testbench_template"].replace("{{INPUT}}", testcase["input_data"])
            result = await compile_and_simulate_verilog(submission_data.code, tb, language)

            # Collect lint warnings from first testcase only
            if idx == 0:
                lint_warnings = result.get("lint_warnings", [])

            if not result["success"]:
                compilation_error = result["error"]
                testcase_results.append({
                    "testcase_id": testcase["testcase_id"],
                    "passed": False,
                    "output": result.get("output"),
                    "error": result["error"]
                })
                logger.error(f"TC {idx + 1} compile/sim error: {result['error'][:200]}")
                break

            # ── Normalized comparison ─────────────────────────────────
            actual = normalize_sim_output(result["output"])
            expected = normalize_sim_output(testcase["expected_output"])
            passed = (actual == expected)

            if passed:
                passed_count += 1

            if result["vcd_data"] and not vcd_data:
                vcd_data = result["vcd_data"]
                waveform_json = result["waveform_json"]

            testcase_results.append({
                "testcase_id": testcase["testcase_id"],
                "passed": passed,
                "output": result["output"] if not testcase["is_hidden"] else None,
                "error": None
            })
            logger.info(f"TC {idx + 1}: {'PASS' if passed else 'FAIL'}")

    total_testcases = 1 if use_custom_testbench else len(problem["testcases"])
    if compilation_error:
        final_status = SubmissionStatus.ERROR
    elif passed_count == total_testcases:
        final_status = SubmissionStatus.PASSED
    else:
        final_status = SubmissionStatus.FAILED

    logger.info(f"Final: {final_status.value} ({passed_count}/{total_testcases})")

    update_fields = {
        "status": final_status.value,
        "testcase_results": testcase_results,
        "passed_count": passed_count,
        "total_count": total_testcases,
        "compilation_error": compilation_error,
        "lint_warnings": lint_warnings,
        "vcd_data": vcd_data,
        "waveform_json": waveform_json,
    }
    await db.submissions.update_one({"submission_id": submission_id}, {"$set": update_fields})

    return {
        "submission_id": submission_id,
        "user_id": user.user_id,
        "problem_id": submission_data.problem_id,
        "code": submission_data.code,
        "testbench": submission_data.testbench,
        "language": language,
        "status": final_status.value,
        "testcase_results": testcase_results,
        "passed_count": passed_count,
        "total_count": total_testcases,
        "compilation_error": compilation_error,
        "lint_warnings": lint_warnings,
        "has_waveform": vcd_data is not None,
        "waveform_json": waveform_json,
        "submitted_at": now.isoformat()
    }


@api_router.get("/submissions/{submission_id}")
async def get_submission(request: Request, submission_id: str):
    user = await require_auth(request)
    submission = await db.submissions.find_one({"submission_id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission["user_id"] != user.user_id and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")
    if isinstance(submission.get("submitted_at"), str):
        submission["submitted_at"] = datetime.fromisoformat(submission["submitted_at"])
    return submission


@api_router.get("/submissions/{submission_id}/vcd")
async def download_vcd(request: Request, submission_id: str):
    """Return the VCD file for a submission (stored as base64 in MongoDB)."""
    user = await require_auth(request)
    submission = await db.submissions.find_one(
        {"submission_id": submission_id},
        {"_id": 0, "user_id": 1, "vcd_data": 1}
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission["user_id"] != user.user_id and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")

    vcd_data = submission.get("vcd_data")
    if not vcd_data:
        raise HTTPException(status_code=404, detail="No waveform data for this submission")

    vcd_bytes = base64.b64decode(vcd_data)
    return StreamingResponse(
        io.BytesIO(vcd_bytes),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={submission_id}.vcd"}
    )


@api_router.get("/submissions/{submission_id}/waveform")
async def get_waveform_json(request: Request, submission_id: str):
    """Return parsed waveform JSON for in-browser waveform rendering."""
    user = await require_auth(request)
    submission = await db.submissions.find_one(
        {"submission_id": submission_id},
        {"_id": 0, "user_id": 1, "waveform_json": 1}
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission["user_id"] != user.user_id and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Access denied")

    waveform = submission.get("waveform_json")
    if not waveform:
        raise HTTPException(status_code=404, detail="No waveform data for this submission")

    return waveform


# ==================== USER STATS (Fixed: no N+1 queries) ====================

@api_router.get("/stats/me")
async def get_user_stats(request: Request):
    """
    Get current user's statistics using a single aggregation pipeline.
    Fixes the N+1 query bug in the original implementation.
    """
    user = await require_auth(request)

    pipeline = [
        {"$match": {"user_id": user.user_id}},
        # Join with problems collection to get difficulty
        {"$lookup": {
            "from": "problems",
            "localField": "problem_id",
            "foreignField": "problem_id",
            "as": "problem_info"
        }},
        {"$unwind": {"path": "$problem_info", "preserveNullAndEmptyArrays": True}},
        # Group to compute stats
        {"$group": {
            "_id": None,
            "total_submissions": {"$sum": 1},
            # Collect unique passed problem_ids with their difficulty
            "passed_problems": {
                "$addToSet": {
                    "$cond": [
                        {"$eq": ["$status", "passed"]},
                        {"problem_id": "$problem_id", "difficulty": "$problem_info.difficulty"},
                        None
                    ]
                }
            }
        }}
    ]

    result = await db.submissions.aggregate(pipeline).to_list(1)

    if not result:
        return {
            "total_solved": 0, "easy_solved": 0, "medium_solved": 0,
            "hard_solved": 0, "total_submissions": 0, "accuracy": 0.0
        }

    agg = result[0]
    total_submissions = agg.get("total_submissions", 0)

    # Filter out None entries from the addToSet
    passed = [p for p in agg.get("passed_problems", []) if p is not None]

    # De-duplicate by problem_id (keep first occurrence)
    seen = set()
    unique_passed = []
    for p in passed:
        pid = p.get("problem_id")
        if pid and pid not in seen:
            seen.add(pid)
            unique_passed.append(p)

    easy_solved = sum(1 for p in unique_passed if p.get("difficulty") == "Easy")
    medium_solved = sum(1 for p in unique_passed if p.get("difficulty") == "Medium")
    hard_solved = sum(1 for p in unique_passed
                      if p.get("difficulty") in ("Hard", "Very Hard"))
    total_solved = len(unique_passed)
    accuracy = round((total_solved / total_submissions * 100), 2) if total_submissions > 0 else 0.0

    return {
        "total_solved": total_solved,
        "easy_solved": easy_solved,
        "medium_solved": medium_solved,
        "hard_solved": hard_solved,
        "total_submissions": total_submissions,
        "accuracy": accuracy
    }


# ==================== ADMIN ROUTES (Paginated) ====================

@api_router.get("/admin/users")
async def get_all_users(request: Request, skip: int = 0, limit: int = 50):
    await require_admin(request)
    limit = min(limit, 200)
    users = await db.users.find(
        {}, {"_id": 0, "password_hash": 0}
    ).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents({})
    return {"users": users, "total": total, "skip": skip, "limit": limit}


@api_router.get("/admin/submissions")
async def get_all_submissions(request: Request, skip: int = 0, limit: int = 100):
    await require_admin(request)
    limit = min(limit, 500)
    submissions = await db.submissions.find(
        {}, {"_id": 0, "vcd_data": 0, "waveform_json": 0}  # exclude heavy fields
    ).sort("submitted_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.submissions.count_documents({})
    return {"submissions": submissions, "total": total, "skip": skip, "limit": limit}


# ==================== HEALTH CHECK ====================

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ==================== MIDDLEWARE & ROUTER ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
