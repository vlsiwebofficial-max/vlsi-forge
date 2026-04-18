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
import secrets
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

# Email Configuration (Resend API — works on Railway)
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
FROM_EMAIL = os.environ.get('FROM_EMAIL', 'onboarding@resend.dev')
EMAIL_CODE_EXPIRY_MINUTES = 15

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

class DomainType(str, Enum):
    RTL_DESIGN = "RTL Design"
    DESIGN_VERIFICATION = "Design Verification"
    COMPUTER_ARCHITECTURE = "Computer Architecture"
    DEBUG_ANALYSIS = "Debug & Analysis"
    PROGRAMMING = "Programming"

# Canonical company ticker list
KNOWN_COMPANIES = [
    "NVIDIA", "Intel", "Qualcomm", "AMD", "Apple",
    "Arm", "Cadence", "Synopsys", "MediaTek", "Broadcom",
    "Samsung", "TSMC", "Marvell", "Micron"
]

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

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str

class ResendVerificationRequest(BaseModel):
    email: EmailStr

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
    domain: Optional[str] = None       # one of DomainType values
    companies: Optional[List[str]] = []  # e.g. ["NVIDIA", "Intel"]
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
    domain: Optional[str] = None
    companies: Optional[List[str]] = []
    constraints: str
    starter_code: str
    testbench_template: str

class ProblemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    tags: Optional[List[str]] = None
    domain: Optional[str] = None
    companies: Optional[List[str]] = None
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
        await db.problems.create_index("domain")
        await db.problems.create_index("companies")
        await db.user_code.create_index([("user_id", 1), ("problem_id", 1)], unique=True)
        await db.submissions.create_index("submission_id", unique=True)
        await db.submissions.create_index([("user_id", 1), ("submitted_at", -1)])
        await db.submissions.create_index([("problem_id", 1), ("status", 1)])
        # TTL index: auto-delete expired sessions
        await db.user_sessions.create_index("session_token")
        await db.user_sessions.create_index(
            "expires_at",
            expireAfterSeconds=0  # MongoDB removes docs when expires_at < now
        )
        # TTL indexes for email tokens — auto-delete after expiry
        await db.email_verification_tokens.create_index("email")
        await db.email_verification_tokens.create_index(
            "expires_at", expireAfterSeconds=0
        )
        await db.password_reset_tokens.create_index("email")
        await db.password_reset_tokens.create_index(
            "expires_at", expireAfterSeconds=0
        )
        logger.info("MongoDB indexes created successfully")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")

@app.on_event("startup")
async def seed_extended_problems_on_startup():
    """Idempotently upsert EXTENDED_PROBLEMS into the DB on every deploy."""
    try:
        inserted = 0
        for p in EXTENDED_PROBLEMS:
            existing = await db.problems.find_one({"title": p["title"]})
            if not existing:
                doc = {**p, "problem_id": str(uuid.uuid4())}
                await db.problems.insert_one(doc)
                inserted += 1
        if inserted:
            logger.info(f"Seeded {inserted} extended problems on startup")
        else:
            logger.info("Extended problems already seeded — skipping")
    except Exception as e:
        logger.warning(f"Extended problems seeding warning: {e}")

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
        except FileNotFoundError:
            return {"success": False, "error": "iverilog not found on this server. Please contact support.",
                    "output": None, "vcd_data": None, "waveform_json": None, "lint_warnings": []}

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
        except FileNotFoundError:
            return {"success": False, "error": "vvp not found on this server. Please contact support.",
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


async def compile_and_simulate_vhdl(code: str, testbench: str) -> dict:
    """
    Compile and simulate VHDL code using GHDL (open-source, LGPL licensed).

    GHDL workflow:
      1. ghdl -a --std=08 design.vhd testbench.vhd  (analyze/compile all files)
      2. ghdl -e --std=08 tb                          (elaborate the top-level entity)
      3. ghdl -r --std=08 tb --vcd=waveform.vcd       (run simulation)
    Testbench must define a top-level entity named 'tb'.
    """
    temp_dir = tempfile.mkdtemp()
    logger.info(f"Starting VHDL simulation in {temp_dir}")

    try:
        design_file = Path(temp_dir) / "design.vhd"
        testbench_file = Path(temp_dir) / "testbench.vhd"
        vcd_file = Path(temp_dir) / "waveform.vcd"

        design_file.write_text(code)
        testbench_file.write_text(testbench)

        ghdl_std = "--std=08"

        # ── Step 1: Analyze (compile) ────────────────────────────────────────
        try:
            rc, stdout, stderr = await run_command_async(
                ["ghdl", "-a", ghdl_std, str(design_file), str(testbench_file)],
                temp_dir, timeout=20
            )
        except asyncio.TimeoutError:
            return {"success": False, "error": "VHDL compilation timeout (20s limit)",
                    "output": None, "vcd_data": None, "waveform_json": None, "lint_warnings": []}
        except FileNotFoundError:
            return {"success": False, "error": "GHDL not found on this server. VHDL support is coming soon.",
                    "output": None, "vcd_data": None, "waveform_json": None, "lint_warnings": []}

        if rc != 0:
            error_msg = stderr or stdout or "VHDL compilation failed"
            logger.error(f"GHDL analyze error: {error_msg[:500]}")
            return {"success": False, "error": error_msg, "output": None,
                    "vcd_data": None, "waveform_json": None, "lint_warnings": []}

        # ── Step 2: Elaborate ────────────────────────────────────────────────
        try:
            rc, stdout, stderr = await run_command_async(
                ["ghdl", "-e", ghdl_std, "tb"],
                temp_dir, timeout=15
            )
        except asyncio.TimeoutError:
            return {"success": False, "error": "VHDL elaboration timeout (15s limit)",
                    "output": None, "vcd_data": None, "waveform_json": None, "lint_warnings": []}

        if rc != 0:
            error_msg = stderr or stdout or "VHDL elaboration failed"
            return {"success": False, "error": error_msg, "output": None,
                    "vcd_data": None, "waveform_json": None, "lint_warnings": []}

        # ── Step 3: Simulate ─────────────────────────────────────────────────
        try:
            rc, sim_stdout, sim_stderr = await run_command_async(
                ["ghdl", "-r", ghdl_std, "tb", f"--vcd={vcd_file}"],
                temp_dir, timeout=10
            )
        except asyncio.TimeoutError:
            return {"success": False, "error": "VHDL simulation timeout (10s limit). Check for infinite loops.",
                    "output": None, "vcd_data": None, "waveform_json": None, "lint_warnings": []}

        logger.info(f"GHDL simulation done (rc={rc}), stdout={len(sim_stdout)} chars")

        # ── Step 4: Read VCD ─────────────────────────────────────────────────
        vcd_data = None
        waveform_json = None
        if vcd_file.exists():
            raw_vcd = vcd_file.read_text(errors="replace")
            vcd_data = base64.b64encode(raw_vcd.encode()).decode()
            try:
                waveform_json = parse_vcd_to_json(raw_vcd)
            except Exception as e:
                logger.warning(f"VCD parse error: {e}")

        return {
            "success": True,
            "error": None,
            "output": sim_stdout,
            "stderr": sim_stderr,
            "vcd_data": vcd_data,
            "waveform_json": waveform_json,
            "lint_warnings": []
        }

    finally:
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


# ==================== EMAIL HELPERS ====================

async def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send email via Resend HTTP API (works on Railway — no SMTP ports needed)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": f"VLSI Forge <{FROM_EMAIL}>",
                    "to": [to_email],
                    "subject": subject,
                    "html": html_body
                }
            )
        if resp.status_code in (200, 201):
            logger.info(f"Email sent to {to_email}")
            return True
        else:
            logger.error(f"Resend API error {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return False


def verification_email_html(name: str, code: str) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; background: #0A0E14; color: #E8EDF4; padding: 32px; border-radius: 12px;">
      <h2 style="color: #4A8FE8; margin-bottom: 8px;">Verify your VLSI Forge account</h2>
      <p style="color: #7A8FA8;">Hi {name}, thanks for signing up! Use the code below to verify your email address.</p>
      <div style="background: #13171E; border: 1px solid #1E2530; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #4A8FE8;">{code}</span>
      </div>
      <p style="color: #7A8FA8; font-size: 13px;">This code expires in {EMAIL_CODE_EXPIRY_MINUTES} minutes. If you did not create an account, ignore this email.</p>
    </div>
    """


def reset_password_email_html(name: str, code: str) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; background: #0A0E14; color: #E8EDF4; padding: 32px; border-radius: 12px;">
      <h2 style="color: #4A8FE8; margin-bottom: 8px;">Reset your VLSI Forge password</h2>
      <p style="color: #7A8FA8;">Hi {name}, we received a request to reset your password. Use the code below.</p>
      <div style="background: #13171E; border: 1px solid #1E2530; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #4A8FE8;">{code}</span>
      </div>
      <p style="color: #7A8FA8; font-size: 13px;">This code expires in {EMAIL_CODE_EXPIRY_MINUTES} minutes. If you did not request a password reset, ignore this email.</p>
    </div>
    """


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
        "email_verified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.users.insert_one(user_doc)

    # Generate and store a 6-digit verification code
    code = str(secrets.randbelow(900000) + 100000)
    await db.email_verification_tokens.insert_one({
        "email": user_data.email,
        "code": code,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=EMAIL_CODE_EXPIRY_MINUTES),
        "created_at": datetime.now(timezone.utc)
    })

    # Fire-and-forget — don't block the response on SMTP
    asyncio.create_task(send_email(
        user_data.email,
        "Verify your VLSI Forge email",
        verification_email_html(user_data.name, code)
    ))

    return JSONResponse(content={
        "requires_verification": True,
        "email": user_data.email,
        "message": "Account created. Please check your email for a verification code."
    })


@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc or "password_hash" not in user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not bcrypt.checkpw(credentials.password.encode(), user_doc["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user_doc.get("email_verified", True):
        raise HTTPException(status_code=403, detail="EMAIL_NOT_VERIFIED")

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


@api_router.post("/auth/verify-email")
async def verify_email(data: VerifyEmailRequest):
    token_doc = await db.email_verification_tokens.find_one(
        {"email": data.email, "code": data.code}
    )
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    expires_at = token_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification code has expired")

    # Mark user as verified
    await db.users.update_one({"email": data.email}, {"$set": {"email_verified": True}})
    # Remove used verification tokens for this email
    await db.email_verification_tokens.delete_many({"email": data.email})

    user_doc = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    # Create a session
    session_token = f"session_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_id": f"sess_{uuid.uuid4().hex[:12]}",
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    response = JSONResponse(content={
        "access_token": session_token,
        "user": {
            "user_id": user_doc["user_id"],
            "email": user_doc["email"],
            "name": user_doc["name"],
            "role": user_doc["role"]
        }
    })
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none",
        max_age=JWT_EXPIRATION_DAYS * 24 * 60 * 60, path="/"
    )
    return response


@api_router.post("/auth/resend-verification")
async def resend_verification(data: ResendVerificationRequest):
    user_doc = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="No account found with this email")
    if user_doc.get("email_verified", False):
        raise HTTPException(status_code=400, detail="Email is already verified")

    # Delete old codes and create new one
    await db.email_verification_tokens.delete_many({"email": data.email})
    code = str(secrets.randbelow(900000) + 100000)
    await db.email_verification_tokens.insert_one({
        "email": data.email,
        "code": code,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=EMAIL_CODE_EXPIRY_MINUTES),
        "created_at": datetime.now(timezone.utc)
    })

    asyncio.create_task(send_email(
        data.email,
        "Verify your VLSI Forge email",
        verification_email_html(user_doc["name"], code)
    ))
    return {"message": "Verification code sent"}


@api_router.post("/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    user_doc = await db.users.find_one({"email": data.email}, {"_id": 0})
    # Always return 200 to avoid email enumeration
    if not user_doc:
        return {"message": "If an account exists, a reset code has been sent"}

    code = str(secrets.randbelow(900000) + 100000)
    await db.password_reset_tokens.delete_many({"email": data.email})
    await db.password_reset_tokens.insert_one({
        "email": data.email,
        "code": code,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=EMAIL_CODE_EXPIRY_MINUTES),
        "created_at": datetime.now(timezone.utc)
    })

    asyncio.create_task(send_email(
        data.email,
        "Reset your VLSI Forge password",
        reset_password_email_html(user_doc["name"], code)
    ))
    return {"message": "If an account exists, a reset code has been sent"}


@api_router.post("/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    token_doc = await db.password_reset_tokens.find_one(
        {"email": data.email, "code": data.code}
    )
    if not token_doc:
        raise HTTPException(status_code=400, detail="Invalid reset code")

    expires_at = token_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset code has expired")

    hashed_password = bcrypt.hashpw(data.new_password.encode(), bcrypt.gensalt())
    await db.users.update_one(
        {"email": data.email},
        {"$set": {"password_hash": hashed_password.decode()}}
    )
    await db.password_reset_tokens.delete_many({"email": data.email})
    # Invalidate all existing sessions for security
    user_doc = await db.users.find_one({"email": data.email}, {"_id": 0})
    if user_doc:
        await db.user_sessions.delete_many({"user_id": user_doc["user_id"]})

    return {"message": "Password reset successfully. Please sign in."}


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
    domain: Optional[str] = None,
    company: Optional[str] = None,
    skip: int = 0,
    limit: int = 200
):
    query: dict = {}
    if difficulty:
        query["difficulty"] = difficulty
    if tag:
        query["tags"] = tag
    if domain:
        query["domain"] = domain
    if company:
        query["companies"] = company

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
        if language == "vhdl":
            result = await compile_and_simulate_vhdl(submission_data.code, submission_data.testbench)
        else:
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
            if language == "vhdl":
                result = await compile_and_simulate_vhdl(submission_data.code, tb)
            else:
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
async def download_vcd(submission_id: str):
    """Return the VCD file for a submission (no auth required — submission IDs are UUIDs with high entropy)."""
    submission = await db.submissions.find_one(
        {"submission_id": submission_id},
        {"_id": 0, "vcd_data": 1}
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

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
async def get_waveform_json(submission_id: str):
    """Return parsed waveform JSON for in-browser waveform rendering (no auth — submission IDs are high-entropy UUIDs)."""
    submission = await db.submissions.find_one(
        {"submission_id": submission_id},
        {"_id": 0, "waveform_json": 1}
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

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


@api_router.get("/stats/solved-problems")
async def get_solved_problems(request: Request):
    """
    Returns the set of problem IDs the current user has solved (status=passed),
    plus a per-domain breakdown. Used by the Problems page to show solved indicators.
    """
    user = await require_auth(request)

    pipeline = [
        {"$match": {"user_id": user.user_id, "status": "passed"}},
        # Deduplicate by problem_id — keep one doc per unique solved problem
        {"$group": {"_id": "$problem_id"}},
        # Join with problems to get domain info
        {"$lookup": {
            "from": "problems",
            "localField": "_id",
            "foreignField": "problem_id",
            "as": "problem_info"
        }},
        {"$unwind": {"path": "$problem_info", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "problem_id": "$_id",
            "domain": "$problem_info.domain",
            "difficulty": "$problem_info.difficulty"
        }}
    ]

    solved_docs = await db.submissions.aggregate(pipeline).to_list(1000)

    solved_ids = [d["problem_id"] for d in solved_docs]

    # Per-domain counts
    domain_solved: Dict[str, int] = {}
    for d in solved_docs:
        dom = d.get("domain") or "Uncategorized"
        domain_solved[dom] = domain_solved.get(dom, 0) + 1

    return {
        "solved_ids": solved_ids,
        "domain_solved": domain_solved,
        "total_solved": len(solved_ids)
    }


# ==================== ACTIVITY HEATMAP ====================

@api_router.get("/stats/heatmap")
async def get_activity_heatmap(request: Request):
    """
    Returns daily submission counts for the past 365 days.
    Used by the Profile page to render a GitHub-style activity heatmap.
    Response: { "days": [ {"date": "2025-04-18", "count": 3}, ... ] }
    """
    user = await require_auth(request)

    cutoff = datetime.now(timezone.utc) - timedelta(days=365)

    pipeline = [
        {"$match": {
            "user_id": user.user_id,
            "submitted_at": {"$gte": cutoff}
        }},
        {"$group": {
            "_id": {
                "$dateToString": {
                    "format": "%Y-%m-%d",
                    "date": "$submitted_at",
                    "timezone": "UTC"
                }
            },
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]

    raw = await db.submissions.aggregate(pipeline).to_list(400)
    days = [{"date": r["_id"], "count": r["count"]} for r in raw]
    return {"days": days}


# ==================== PER-PROBLEM SUBMISSION HISTORY ====================

@api_router.get("/submissions/problem/{problem_id}")
async def get_problem_submissions(request: Request, problem_id: str, limit: int = 20):
    """
    Get the current user's submission history for a specific problem.
    Most recent first. Excludes heavy binary fields.
    """
    user = await require_auth(request)
    limit = min(limit, 50)

    submissions = await db.submissions.find(
        {"user_id": user.user_id, "problem_id": problem_id},
        {"_id": 0, "vcd_data": 0, "waveform_json": 0, "code": 0}
    ).sort("submitted_at", -1).limit(limit).to_list(limit)

    for s in submissions:
        if isinstance(s.get("submitted_at"), datetime):
            s["submitted_at"] = s["submitted_at"].isoformat()

    return submissions


# ==================== DAILY CHALLENGE ====================

@api_router.get("/problems/daily")
async def get_daily_problem(request: Request):
    """
    Returns a deterministic 'problem of the day' by hashing today's UTC date
    against the list of all problem IDs. Same problem for all users on a given day.
    """
    await require_auth(request)

    problems = await db.problems.find(
        {}, {"_id": 0, "problem_id": 1, "title": 1, "difficulty": 1, "domain": 1}
    ).to_list(500)

    if not problems:
        raise HTTPException(status_code=404, detail="No problems available")

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    idx = int(__import__('hashlib').md5(today_str.encode()).hexdigest(), 16) % len(problems)
    daily = problems[idx]
    daily["date"] = today_str
    return daily


# ==================== LEADERBOARD ====================

@api_router.get("/leaderboard")
async def get_leaderboard(request: Request, limit: int = 50):
    """
    Top users ranked by unique problems solved (status=passed).
    Ties broken by total submissions (fewer = higher rank).
    """
    await require_auth(request)
    limit = min(limit, 100)

    pipeline = [
        {"$match": {"status": "passed"}},
        # One entry per (user_id, problem_id) pair
        {"$group": {
            "_id": {"user_id": "$user_id", "problem_id": "$problem_id"}
        }},
        # Count unique problems per user
        {"$group": {
            "_id": "$_id.user_id",
            "problems_solved": {"$sum": 1}
        }},
        {"$sort": {"problems_solved": -1}},
        {"$limit": limit},
        # Join with users for display name
        {"$lookup": {
            "from": "users",
            "localField": "_id",
            "foreignField": "user_id",
            "as": "user_info"
        }},
        {"$unwind": {"path": "$user_info", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "_id": 0,
            "user_id": "$_id",
            "name": "$user_info.name",
            "problems_solved": 1
        }}
    ]

    rows = await db.submissions.aggregate(pipeline).to_list(limit)

    # Attach rank
    for i, row in enumerate(rows):
        row["rank"] = i + 1
        # Mask email-style names for privacy: keep first name only
        if row.get("name"):
            row["display_name"] = row["name"].split()[0] + (" " + row["name"].split()[1][0] + "." if len(row["name"].split()) > 1 else "")
        else:
            row["display_name"] = "User"

    return rows


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


# ==================== USER CODE PERSISTENCE ====================

class UserCodeSave(BaseModel):
    code: str
    language: Optional[str] = "verilog"

@api_router.get("/user-code/{problem_id}")
async def get_user_code(request: Request, problem_id: str):
    """Return the user's last saved code for a problem."""
    user = await require_auth(request)
    doc = await db.user_code.find_one(
        {"user_id": user.user_id, "problem_id": problem_id},
        {"_id": 0, "code": 1, "language": 1, "saved_at": 1}
    )
    if not doc:
        return {"code": None, "language": "verilog", "saved_at": None}
    return doc

@api_router.put("/user-code/{problem_id}")
async def save_user_code(request: Request, problem_id: str, body: UserCodeSave):
    """Upsert the user's code draft for a problem (called on every editor change via debounce)."""
    user = await require_auth(request)
    now = datetime.now(timezone.utc).isoformat()
    await db.user_code.update_one(
        {"user_id": user.user_id, "problem_id": problem_id},
        {"$set": {
            "user_id": user.user_id,
            "problem_id": problem_id,
            "code": body.code,
            "language": body.language,
            "saved_at": now,
        }},
        upsert=True
    )
    return {"saved": True, "saved_at": now}


# ==================== ADMIN: BATCH PROBLEM INSERT ====================

@api_router.post("/admin/problems/batch")
async def batch_add_problems(request: Request):
    """
    Insert a list of problems from the EXTENDED_PROBLEMS list.
    Skips any problem whose title already exists (idempotent).
    Admin-only.
    """
    await require_admin(request)
    inserted = []
    skipped = []
    now = datetime.now(timezone.utc)

    for p in EXTENDED_PROBLEMS:
        existing = await db.problems.find_one({"title": p["title"]})
        if existing:
            skipped.append(p["title"])
            continue

        problem_id = f"prob_{uuid.uuid4().hex[:12]}"
        tc_docs = []
        for tc in p.get("testcases", []):
            tc_docs.append({
                "testcase_id": f"tc_{uuid.uuid4().hex[:8]}",
                "input_data": tc["input_data"],
                "expected_output": tc["expected_output"],
                "is_hidden": tc.get("is_hidden", False),
            })

        doc = {
            "problem_id": problem_id,
            "title": p["title"],
            "description": p["description"],
            "difficulty": p["difficulty"],
            "tags": p.get("tags", []),
            "domain": p.get("domain"),
            "companies": p.get("companies", []),
            "constraints": p.get("constraints", ""),
            "starter_code": p.get("starter_code", ""),
            "testbench_template": p.get("testbench_template", ""),
            "testcases": tc_docs,
            "created_by": "system",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        await db.problems.insert_one(doc)
        inserted.append(p["title"])

    return {"inserted": inserted, "skipped": skipped,
            "inserted_count": len(inserted), "skipped_count": len(skipped)}


# ==================== ONE-TIME SEED ====================

EXTENDED_PROBLEMS = [
    # ── RTL Design ──────────────────────────────────────────────────────────────
    {
        "title": "Full Adder",
        "difficulty": "Easy",
        "domain": "RTL Design",
        "companies": ["Intel", "Qualcomm", "AMD"],
        "tags": ["combinational", "arithmetic"],
        "description": "Design a 1-bit full adder with inputs `a`, `b`, `cin` and outputs `sum`, `cout`.\n\nA full adder adds three 1-bit numbers and produces a sum and carry-out.\n\n**Boolean equations:**\n- sum = a ⊕ b ⊕ cin\n- cout = (a·b) + (cin·(a⊕b))",
        "constraints": "- Combinational logic only\n- No clock required",
        "starter_code": "module full_adder(\n    input  a, b, cin,\n    output sum, cout\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg a, b, cin;\n    wire sum, cout;\n    full_adder dut(.a(a),.b(b),.cin(cin),.sum(sum),.cout(cout));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "a=0;b=0;cin=0;#10;$display(\"%b %b\",sum,cout);", "expected_output": "0 0", "is_hidden": False},
            {"input_data": "a=0;b=1;cin=1;#10;$display(\"%b %b\",sum,cout);", "expected_output": "0 1", "is_hidden": False},
            {"input_data": "a=1;b=1;cin=0;#10;$display(\"%b %b\",sum,cout);", "expected_output": "0 1", "is_hidden": False},
            {"input_data": "a=1;b=1;cin=1;#10;$display(\"%b %b\",sum,cout);", "expected_output": "1 1", "is_hidden": True},
        ],
    },
    {
        "title": "4-to-1 Multiplexer",
        "difficulty": "Easy",
        "domain": "RTL Design",
        "companies": ["Qualcomm", "MediaTek"],
        "tags": ["combinational", "mux"],
        "description": "Implement a 4-to-1 multiplexer with 4 single-bit data inputs `d[3:0]`, a 2-bit select `sel[1:0]`, and single-bit output `out`.\n\n- sel=00 → out=d[0]\n- sel=01 → out=d[1]\n- sel=10 → out=d[2]\n- sel=11 → out=d[3]",
        "constraints": "- Purely combinational\n- No latches",
        "starter_code": "module mux4to1(\n    input  [3:0] d,\n    input  [1:0] sel,\n    output out\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg [3:0] d; reg [1:0] sel; wire out;\n    mux4to1 dut(.d(d),.sel(sel),.out(out));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "d=4'b1010;sel=2'b00;#10;$display(\"%b\",out);", "expected_output": "0", "is_hidden": False},
            {"input_data": "d=4'b1010;sel=2'b01;#10;$display(\"%b\",out);", "expected_output": "1", "is_hidden": False},
            {"input_data": "d=4'b1010;sel=2'b10;#10;$display(\"%b\",out);", "expected_output": "0", "is_hidden": False},
            {"input_data": "d=4'b1010;sel=2'b11;#10;$display(\"%b\",out);", "expected_output": "1", "is_hidden": True},
        ],
    },
    {
        "title": "4-bit Synchronous Counter",
        "difficulty": "Easy",
        "domain": "RTL Design",
        "companies": ["NVIDIA", "Intel"],
        "tags": ["sequential", "counter"],
        "description": "Design a 4-bit synchronous up-counter with synchronous active-high reset.\n\n- On every rising clock edge: if `rst=1`, reset to 0; else increment by 1\n- Counter wraps from 15 back to 0 (natural overflow)\n- Output `count[3:0]` reflects current counter value",
        "constraints": "- Synchronous reset\n- Positive-edge triggered\n- 4-bit output",
        "starter_code": "module counter4(\n    input        clk, rst,\n    output reg [3:0] count\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0, rst;\n    wire [3:0] count;\n    always #5 clk=~clk;\n    counter4 dut(.clk(clk),.rst(rst),.count(count));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;@(posedge clk);#1;$display(\"%0d\",count);", "expected_output": "0", "is_hidden": False},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;repeat(3)@(posedge clk);#1;$display(\"%0d\",count);", "expected_output": "3", "is_hidden": False},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;repeat(15)@(posedge clk);#1;$display(\"%0d\",count);", "expected_output": "15", "is_hidden": True},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;repeat(16)@(posedge clk);#1;$display(\"%0d\",count);", "expected_output": "0", "is_hidden": True},
        ],
    },
    {
        "title": "Priority Encoder (4-to-2)",
        "difficulty": "Medium",
        "domain": "RTL Design",
        "companies": ["Qualcomm", "AMD", "Broadcom"],
        "tags": ["combinational", "encoder"],
        "description": "Implement a 4-to-2 priority encoder.\n\nInputs `req[3:0]` represent 4 request lines. Output `grant[1:0]` encodes the index of the **highest-priority** active request (bit 3 is highest priority).\n\nAlso output `valid` — asserted when at least one request is active.\n\n**Priority:** req[3] > req[2] > req[1] > req[0]",
        "constraints": "- If no request is active, `valid=0` and `grant` is don't-care\n- Purely combinational",
        "starter_code": "module priority_enc(\n    input  [3:0] req,\n    output reg [1:0] grant,\n    output reg valid\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg [3:0] req; wire [1:0] grant; wire valid;\n    priority_enc dut(.req(req),.grant(grant),.valid(valid));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "req=4'b0001;#10;$display(\"%0d %b\",grant,valid);", "expected_output": "0 1", "is_hidden": False},
            {"input_data": "req=4'b0110;#10;$display(\"%0d %b\",grant,valid);", "expected_output": "2 1", "is_hidden": False},
            {"input_data": "req=4'b1010;#10;$display(\"%0d %b\",grant,valid);", "expected_output": "3 1", "is_hidden": False},
            {"input_data": "req=4'b0000;#10;$display(\"%b\",valid);", "expected_output": "0", "is_hidden": True},
        ],
    },
    {
        "title": "8-bit Barrel Shifter",
        "difficulty": "Medium",
        "domain": "RTL Design",
        "companies": ["ARM", "NVIDIA", "Intel"],
        "tags": ["combinational", "shifter", "datapath"],
        "description": "Design an 8-bit barrel shifter that can perform left logical shifts.\n\n- Input `data[7:0]`: value to shift\n- Input `shamt[2:0]`: shift amount (0–7)\n- Output `out[7:0]`: `data` shifted left by `shamt` positions\n- Vacated LSBs are filled with 0",
        "constraints": "- Combinational logic\n- No sequential elements",
        "starter_code": "module barrel_shift(\n    input  [7:0] data,\n    input  [2:0] shamt,\n    output [7:0] out\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg [7:0] data; reg [2:0] shamt; wire [7:0] out;\n    barrel_shift dut(.data(data),.shamt(shamt),.out(out));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "data=8'b00000001;shamt=3'd1;#10;$display(\"%08b\",out);", "expected_output": "00000010", "is_hidden": False},
            {"input_data": "data=8'b00000001;shamt=3'd4;#10;$display(\"%08b\",out);", "expected_output": "00010000", "is_hidden": False},
            {"input_data": "data=8'b10110011;shamt=3'd2;#10;$display(\"%08b\",out);", "expected_output": "11001100", "is_hidden": True},
            {"input_data": "data=8'b10000000;shamt=3'd1;#10;$display(\"%08b\",out);", "expected_output": "00000000", "is_hidden": True},
        ],
    },
    {
        "title": "Moore FSM — Sequence Detector (101)",
        "difficulty": "Medium",
        "domain": "RTL Design",
        "companies": ["Intel", "Qualcomm", "NVIDIA"],
        "tags": ["sequential", "FSM", "Moore"],
        "description": "Design a **Moore FSM** that detects the sequence `101` on serial input `din`.\n\nOutput `detect` is HIGH for exactly one clock cycle when the sequence `101` is completed.\n\n- Non-overlapping detection (after detecting `101`, the FSM resets to IDLE)\n- Synchronous active-high reset\n- Positive-edge triggered",
        "constraints": "- Moore machine: output depends only on current state\n- Non-overlapping detection",
        "starter_code": "module seq_detector(\n    input  clk, rst, din,\n    output reg detect\n);\n    // Define states and transitions\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst,din; wire detect;\n    always #5 clk=~clk;\n    seq_detector dut(.clk(clk),.rst(rst),.din(din),.detect(detect));\n    task send(input b); din=b; @(posedge clk); #1; endtask\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;send(1);send(0);send(1);$display(\"%b\",detect);", "expected_output": "1", "is_hidden": False},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;send(1);send(1);send(1);$display(\"%b\",detect);", "expected_output": "0", "is_hidden": False},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;send(0);send(1);send(0);send(1);$display(\"%b\",detect);", "expected_output": "1", "is_hidden": True},
        ],
    },
    {
        "title": "Synchronous FIFO (4-deep)",
        "difficulty": "Hard",
        "domain": "RTL Design",
        "companies": ["NVIDIA", "Intel", "Broadcom", "Marvell"],
        "tags": ["sequential", "FIFO", "memory"],
        "description": "Design a synchronous FIFO with depth 4 and data width 8 bits.\n\n**Ports:**\n- `clk`, `rst` (sync active-high)\n- `wr_en`: write enable — push `din[7:0]`\n- `rd_en`: read enable — pop `dout[7:0]`\n- `full`: asserted when FIFO is full\n- `empty`: asserted when FIFO is empty\n\n**Behaviour:**\n- Write on rising edge when `wr_en=1` and `!full`\n- Read on rising edge when `rd_en=1` and `!empty`\n- `empty` is HIGH after reset",
        "constraints": "- Depth = 4, Width = 8\n- No overflow or underflow\n- Synthesisable RTL",
        "starter_code": "module fifo4(\n    input        clk, rst,\n    input        wr_en, rd_en,\n    input  [7:0] din,\n    output reg [7:0] dout,\n    output       full, empty\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst,wr_en,rd_en; reg [7:0] din;\n    wire [7:0] dout; wire full,empty;\n    always #5 clk=~clk;\n    fifo4 dut(.clk(clk),.rst(rst),.wr_en(wr_en),.rd_en(rd_en),.din(din),.dout(dout),.full(full),.empty(empty));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;wr_en=0;rd_en=0;@(posedge clk);#1;rst=0;$display(\"%b\",empty);", "expected_output": "1", "is_hidden": False},
            {"input_data": "rst=1;wr_en=0;rd_en=0;@(posedge clk);#1;rst=0;wr_en=1;din=8'hAB;@(posedge clk);#1;wr_en=0;rd_en=1;@(posedge clk);#1;$display(\"%h\",dout);", "expected_output": "ab", "is_hidden": False},
            {"input_data": "rst=1;wr_en=0;rd_en=0;@(posedge clk);#1;rst=0;wr_en=1;din=8'h01;@(posedge clk);#1;din=8'h02;@(posedge clk);#1;din=8'h03;@(posedge clk);#1;din=8'h04;@(posedge clk);#1;wr_en=0;$display(\"%b\",full);", "expected_output": "1", "is_hidden": True},
        ],
    },
    {
        "title": "Round-Robin Arbiter (4 requestors)",
        "difficulty": "Hard",
        "domain": "RTL Design",
        "companies": ["NVIDIA", "Broadcom", "Marvell", "Intel"],
        "tags": ["sequential", "arbiter", "fairness"],
        "description": "Design a 4-requestor round-robin arbiter.\n\n**Ports:**\n- `clk`, `rst` (sync active-high)\n- `req[3:0]`: request lines (active-high)\n- `grant[3:0]`: one-hot grant output\n\n**Behaviour:**\n- Grant is given to the next requesting client after the last grant (round-robin order)\n- Only one grant active at a time (one-hot)\n- After reset, start arbitrating from requestor 0",
        "constraints": "- One-hot grant output\n- Fair round-robin, no starvation\n- Synchronous reset",
        "starter_code": "module rr_arbiter(\n    input      clk, rst,\n    input  [3:0] req,\n    output reg [3:0] grant\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst; reg [3:0] req; wire [3:0] grant;\n    always #5 clk=~clk;\n    rr_arbiter dut(.clk(clk),.rst(rst),.req(req),.grant(grant));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;req=4'b0000;@(posedge clk);#1;rst=0;req=4'b0001;@(posedge clk);#1;$display(\"%04b\",grant);", "expected_output": "0001", "is_hidden": False},
            {"input_data": "rst=1;req=4'b0000;@(posedge clk);#1;rst=0;req=4'b0011;@(posedge clk);#1;$display(\"%04b\",grant);", "expected_output": "0001", "is_hidden": False},
            {"input_data": "rst=1;req=4'b0000;@(posedge clk);#1;rst=0;req=4'b0011;@(posedge clk);#1;req=4'b0010;@(posedge clk);#1;$display(\"%04b\",grant);", "expected_output": "0010", "is_hidden": True},
        ],
    },
    # ── Design Verification ─────────────────────────────────────────────────────
    {
        "title": "Verify a Half Adder (Exhaustive)",
        "difficulty": "Easy",
        "domain": "Design Verification",
        "companies": ["Cadence", "Synopsys", "Intel"],
        "tags": ["testbench", "verification", "exhaustive"],
        "description": "Write a **self-checking testbench** for the following half adder module. Your testbench must test **all 4 input combinations** and use `$error` or `$display` to report any mismatches.\n\nThe DUT is provided — do not modify it.\n\n```verilog\nmodule half_adder(\n    input  a, b,\n    output sum, carry\n);\n    assign sum   = a ^ b;\n    assign carry = a & b;\nendmodule\n```\n\nOutput a single line: `PASS` if all tests pass, or `FAIL` on first mismatch.",
        "constraints": "- Must test all 4 input combinations\n- Output exactly `PASS` or `FAIL`\n- Use `$finish` to end simulation",
        "starter_code": "// Write your testbench here\n// The DUT (half_adder) will be compiled alongside your testbench\nmodule tb;\n    // Your testbench code\nendmodule",
        "testbench_template": "module half_adder(\n    input  a, b,\n    output sum, carry\n);\n    assign sum   = a ^ b;\n    assign carry = a & b;\nendmodule\n{{INPUT}}",
        "testcases": [
            {"input_data": "// testbench is in the code above", "expected_output": "PASS", "is_hidden": False},
        ],
    },
    {
        "title": "Clock Domain Crossing — Sync Flop",
        "difficulty": "Medium",
        "domain": "Design Verification",
        "companies": ["NVIDIA", "Intel", "Qualcomm"],
        "tags": ["CDC", "synchronizer", "metastability"],
        "description": "Design a **2-flop synchronizer** for crossing a single-bit signal from a slow clock domain to a fast clock domain.\n\nThe synchronizer must consist of exactly **two pipeline registers** clocked on `clk_dst`.\n\n**Ports:**\n- `clk_dst`: destination domain clock\n- `rst`: async active-high reset\n- `data_in`: async input (from source domain)\n- `data_out`: synchronized output (in destination domain)\n\nThis is a fundamental CDC primitive used in every SoC.",
        "constraints": "- Exactly 2 pipeline flops\n- Asynchronous reset (both flops reset to 0)\n- Output is registered",
        "starter_code": "module sync_2ff(\n    input  clk_dst,\n    input  rst,\n    input  data_in,\n    output data_out\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst,data_in; wire data_out;\n    always #5 clk=~clk;\n    sync_2ff dut(.clk_dst(clk),.rst(rst),.data_in(data_in),.data_out(data_out));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;data_in=0;repeat(3)@(posedge clk);#1;rst=0;$display(\"%b\",data_out);", "expected_output": "0", "is_hidden": False},
            {"input_data": "rst=1;data_in=0;repeat(3)@(posedge clk);#1;rst=0;data_in=1;@(posedge clk);#1;$display(\"%b\",data_out);", "expected_output": "0", "is_hidden": False},
            {"input_data": "rst=1;data_in=0;repeat(3)@(posedge clk);#1;rst=0;data_in=1;repeat(2)@(posedge clk);#1;$display(\"%b\",data_out);", "expected_output": "1", "is_hidden": True},
        ],
    },
    {
        "title": "Gray Code Counter (4-bit)",
        "difficulty": "Medium",
        "domain": "Design Verification",
        "companies": ["Intel", "Marvell", "Cadence"],
        "tags": ["sequential", "counter", "gray-code"],
        "description": "Design a 4-bit **Gray code counter** — a counter that increments through Gray code values (only 1 bit changes per step).\n\n**Ports:**\n- `clk`: clock\n- `rst`: synchronous active-high reset (resets to 4'b0000)\n- `en`: enable — counter increments only when high\n- `gray[3:0]`: current Gray code value\n\n**Gray code sequence (first 8):** 0000 → 0001 → 0011 → 0010 → 0110 → 0111 → 0101 → 0100 → ...",
        "constraints": "- Output must follow Gray code sequence\n- Synchronous reset and enable",
        "starter_code": "module gray_counter(\n    input      clk, rst, en,\n    output reg [3:0] gray\n);\n    // Hint: use a binary counter internally, then convert\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst,en; wire [3:0] gray;\n    always #5 clk=~clk;\n    gray_counter dut(.clk(clk),.rst(rst),.en(en),.gray(gray));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;en=0;@(posedge clk);#1;rst=0;$display(\"%04b\",gray);", "expected_output": "0000", "is_hidden": False},
            {"input_data": "rst=1;en=0;@(posedge clk);#1;rst=0;en=1;@(posedge clk);#1;$display(\"%04b\",gray);", "expected_output": "0001", "is_hidden": False},
            {"input_data": "rst=1;en=0;@(posedge clk);#1;rst=0;en=1;repeat(3)@(posedge clk);#1;$display(\"%04b\",gray);", "expected_output": "0010", "is_hidden": True},
        ],
    },
    # ── Computer Architecture ───────────────────────────────────────────────────
    {
        "title": "Register File (8×8)",
        "difficulty": "Medium",
        "domain": "Computer Architecture",
        "companies": ["NVIDIA", "ARM", "Intel", "AMD"],
        "tags": ["memory", "register-file", "datapath"],
        "description": "Implement a small **8-register × 8-bit register file** — a fundamental building block in every CPU datapath.\n\n**Ports:**\n- `clk`\n- `wr_en`: write enable\n- `wr_addr[2:0]`: write register index\n- `wr_data[7:0]`: data to write\n- `rd_addr1[2:0]`, `rd_addr2[2:0]`: two independent read ports\n- `rd_data1[7:0]`, `rd_data2[7:0]`: read outputs\n\n**Behaviour:**\n- Synchronous write on rising edge when `wr_en=1`\n- Asynchronous read (combinational)\n- Register 0 is hardwired to 0 (writes to r0 are ignored)",
        "constraints": "- Register 0 always reads 0\n- Asynchronous read, synchronous write",
        "starter_code": "module reg_file(\n    input         clk, wr_en,\n    input  [2:0]  wr_addr, rd_addr1, rd_addr2,\n    input  [7:0]  wr_data,\n    output [7:0]  rd_data1, rd_data2\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,wr_en; reg [2:0] wr_addr,rd_addr1,rd_addr2;\n    reg [7:0] wr_data; wire [7:0] rd_data1,rd_data2;\n    always #5 clk=~clk;\n    reg_file dut(.clk(clk),.wr_en(wr_en),.wr_addr(wr_addr),.rd_addr1(rd_addr1),.rd_addr2(rd_addr2),.wr_data(wr_data),.rd_data1(rd_data1),.rd_data2(rd_data2));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "wr_en=1;wr_addr=3'd1;wr_data=8'hAB;@(posedge clk);#1;wr_en=0;rd_addr1=3'd1;rd_addr2=3'd0;#1;$display(\"%h %h\",rd_data1,rd_data2);", "expected_output": "ab 00", "is_hidden": False},
            {"input_data": "wr_en=1;wr_addr=3'd0;wr_data=8'hFF;@(posedge clk);#1;wr_en=0;rd_addr1=3'd0;#1;$display(\"%h\",rd_data1);", "expected_output": "00", "is_hidden": False},
            {"input_data": "wr_en=1;wr_addr=3'd5;wr_data=8'h42;@(posedge clk);#1;wr_en=1;wr_addr=3'd5;wr_data=8'h99;@(posedge clk);#1;wr_en=0;rd_addr1=3'd5;#1;$display(\"%h\",rd_data1);", "expected_output": "99", "is_hidden": True},
        ],
    },
    {
        "title": "ALU (4-bit, 4 operations)",
        "difficulty": "Medium",
        "domain": "Computer Architecture",
        "companies": ["ARM", "NVIDIA", "Intel", "AMD"],
        "tags": ["combinational", "ALU", "datapath"],
        "description": "Design a 4-bit Arithmetic Logic Unit (ALU) supporting 4 operations.\n\n**Ports:**\n- `a[3:0]`, `b[3:0]`: operands\n- `op[1:0]`: operation select\n- `result[3:0]`: output\n- `zero`: asserted when `result == 0`\n\n**Operations:**\n| op | Function |\n|----|----------|\n| 00 | ADD: result = a + b |\n| 01 | SUB: result = a - b |\n| 10 | AND: result = a & b |\n| 11 | OR:  result = a \\| b |",
        "constraints": "- Combinational logic\n- `zero` flag is purely combinational",
        "starter_code": "module alu4(\n    input  [3:0] a, b,\n    input  [1:0] op,\n    output reg [3:0] result,\n    output zero\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg [3:0] a,b; reg [1:0] op; wire [3:0] result; wire zero;\n    alu4 dut(.a(a),.b(b),.op(op),.result(result),.zero(zero));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "a=4'd5;b=4'd3;op=2'b00;#10;$display(\"%0d\",result);", "expected_output": "8", "is_hidden": False},
            {"input_data": "a=4'd5;b=4'd3;op=2'b01;#10;$display(\"%0d\",result);", "expected_output": "2", "is_hidden": False},
            {"input_data": "a=4'b1010;b=4'b1100;op=2'b10;#10;$display(\"%04b\",result);", "expected_output": "1000", "is_hidden": False},
            {"input_data": "a=4'd5;b=4'd5;op=2'b01;#10;$display(\"%b\",zero);", "expected_output": "1", "is_hidden": True},
        ],
    },
    {
        "title": "Pipeline Register (2-stage)",
        "difficulty": "Hard",
        "domain": "Computer Architecture",
        "companies": ["NVIDIA", "ARM", "Intel", "AMD"],
        "tags": ["pipeline", "registers", "architecture"],
        "description": "Implement a **2-stage pipeline** for the following computation:\n\n**Stage 1 (combinational):** `add_result = a + b`\n**Stage 2 (registered):** `mul_result = add_result * c` (use 8-bit result)\n\n**Ports:**\n- `clk`\n- `rst`: synchronous active-high\n- `a[3:0]`, `b[3:0]`, `c[3:0]`: inputs (sampled in Stage 1 each cycle)\n- `result[7:0]`: final output (1-cycle pipeline latency after first input)\n- `valid`: HIGH when result is valid (after first pipeline fill cycle)\n\nThis models the IF→EX pipeline pattern used in every processor.",
        "constraints": "- 1-cycle latency between input and result\n- `valid` should go high after the first clock following reset de-assertion with inputs present",
        "starter_code": "module pipe2(\n    input        clk, rst,\n    input  [3:0] a, b, c,\n    output reg [7:0] result,\n    output reg valid\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst; reg [3:0] a,b,c; wire [7:0] result; wire valid;\n    always #5 clk=~clk;\n    pipe2 dut(.clk(clk),.rst(rst),.a(a),.b(b),.c(c),.result(result),.valid(valid));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;a=0;b=0;c=0;@(posedge clk);#1;rst=0;$display(\"%b\",valid);", "expected_output": "0", "is_hidden": False},
            {"input_data": "rst=1;a=0;b=0;c=0;@(posedge clk);#1;rst=0;a=4'd2;b=4'd3;c=4'd4;@(posedge clk);#1;$display(\"%b %0d\",valid,result);", "expected_output": "1 20", "is_hidden": False},
            {"input_data": "rst=1;a=0;b=0;c=0;@(posedge clk);#1;rst=0;a=4'd1;b=4'd2;c=4'd3;@(posedge clk);#1;a=4'd4;b=4'd5;c=4'd2;@(posedge clk);#1;$display(\"%0d\",result);", "expected_output": "18", "is_hidden": True},
        ],
    },
    # ── RTL Design — More ───────────────────────────────────────────────────────
    {
        "title": "D Flip-Flop (Async Reset)",
        "difficulty": "Easy",
        "domain": "RTL Design",
        "companies": ["Intel", "ARM", "NVIDIA"],
        "tags": ["sequential", "flip-flop", "async-reset"],
        "description": "Design a positive-edge-triggered D flip-flop with **asynchronous active-high reset**.\n\n- On rising clock edge: `q <= d` (if `rst` is not asserted)\n- Whenever `rst=1` (regardless of clock): `q` is immediately forced to 0\n\nAsynchronous reset is the standard choice for power-on reset in real chips.",
        "constraints": "- Asynchronous reset\n- Positive-edge triggered clock",
        "starter_code": "module dff_async(\n    input  clk,\n    input  rst,  // async active-high\n    input  d,\n    output reg q\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst,d; wire q;\n    always #5 clk=~clk;\n    dff_async dut(.clk(clk),.rst(rst),.d(d),.q(q));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;d=1;#3;$display(\"%b\",q);", "expected_output": "0", "is_hidden": False},
            {"input_data": "rst=1;d=1;#3;rst=0;@(posedge clk);#1;$display(\"%b\",q);", "expected_output": "1", "is_hidden": False},
            {"input_data": "rst=0;d=1;@(posedge clk);#1;rst=1;#2;$display(\"%b\",q);", "expected_output": "0", "is_hidden": True},
        ],
    },
    {
        "title": "Ripple Carry Adder (4-bit)",
        "difficulty": "Easy",
        "domain": "RTL Design",
        "companies": ["Intel", "AMD", "Qualcomm"],
        "tags": ["combinational", "arithmetic", "structural"],
        "description": "Build a 4-bit ripple carry adder using **structural instantiation** of four 1-bit full adders.\n\n**Ports:**\n- `a[3:0]`, `b[3:0]`: operands\n- `cin`: carry-in to bit 0\n- `sum[3:0]`: result\n- `cout`: carry-out from bit 3\n\nInstantiate a `full_adder` sub-module for each bit position and chain the carry.\n\nA ripple carry adder is the simplest multi-bit adder architecture — the carry \"ripples\" from LSB to MSB.",
        "constraints": "- Must use structural full-adder instantiation\n- Define both `full_adder` and `rca4` in your code",
        "starter_code": "// 1-bit Full Adder (sub-module)\nmodule full_adder(\n    input  a, b, cin,\n    output sum, cout\n);\n    // Your code here\nendmodule\n\n// 4-bit Ripple Carry Adder\nmodule rca4(\n    input  [3:0] a, b,\n    input        cin,\n    output [3:0] sum,\n    output       cout\n);\n    // Instantiate 4 full adders\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg [3:0] a,b; reg cin; wire [3:0] sum; wire cout;\n    rca4 dut(.a(a),.b(b),.cin(cin),.sum(sum),.cout(cout));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "a=4'd5;b=4'd3;cin=0;#10;$display(\"%0d %b\",sum,cout);", "expected_output": "8 0", "is_hidden": False},
            {"input_data": "a=4'd15;b=4'd1;cin=0;#10;$display(\"%0d %b\",sum,cout);", "expected_output": "0 1", "is_hidden": False},
            {"input_data": "a=4'd7;b=4'd8;cin=1;#10;$display(\"%0d %b\",sum,cout);", "expected_output": "0 1", "is_hidden": True},
            {"input_data": "a=4'd6;b=4'd9;cin=0;#10;$display(\"%0d\",sum);", "expected_output": "15", "is_hidden": True},
        ],
    },
    {
        "title": "3-bit Up/Down Counter",
        "difficulty": "Easy",
        "domain": "RTL Design",
        "companies": ["Intel", "Qualcomm", "MediaTek"],
        "tags": ["sequential", "counter"],
        "description": "Design a 3-bit up/down counter.\n\n**Ports:**\n- `clk`, `rst`: synchronous active-high reset (resets to 0)\n- `up_dn`: direction — `1` = count up, `0` = count down\n- `en`: enable — counter only changes when `en=1`\n- `count[2:0]`: current count value\n\nThe counter wraps naturally: counting up from 7 wraps to 0; counting down from 0 wraps to 7.",
        "constraints": "- Synchronous reset and enable\n- Natural 3-bit wrap-around",
        "starter_code": "module updown_counter(\n    input        clk, rst, en, up_dn,\n    output reg [2:0] count\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst,en,up_dn; wire [2:0] count;\n    always #5 clk=~clk;\n    updown_counter dut(.clk(clk),.rst(rst),.en(en),.up_dn(up_dn),.count(count));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;en=1;up_dn=1;@(posedge clk);#1;rst=0;repeat(3)@(posedge clk);#1;$display(\"%0d\",count);", "expected_output": "3", "is_hidden": False},
            {"input_data": "rst=1;en=1;up_dn=0;@(posedge clk);#1;rst=0;@(posedge clk);#1;$display(\"%0d\",count);", "expected_output": "7", "is_hidden": False},
            {"input_data": "rst=1;en=1;up_dn=1;@(posedge clk);#1;rst=0;repeat(7)@(posedge clk);#1;up_dn=0;@(posedge clk);#1;$display(\"%0d\",count);", "expected_output": "6", "is_hidden": True},
            {"input_data": "rst=1;en=0;up_dn=1;@(posedge clk);#1;rst=0;repeat(5)@(posedge clk);#1;$display(\"%0d\",count);", "expected_output": "0", "is_hidden": True},
        ],
    },
    {
        "title": "Mealy FSM — Sequence Detector (1011)",
        "difficulty": "Medium",
        "domain": "RTL Design",
        "companies": ["Intel", "Qualcomm", "NVIDIA", "AMD"],
        "tags": ["sequential", "FSM", "Mealy"],
        "description": "Design a **Mealy FSM** that detects the sequence `1011` on serial input `din`.\n\n- Output `detect` is HIGH during the clock cycle in which the last bit (`1`) of the sequence is received\n- **Overlapping** detection — after `1011`, the FSM reuses the trailing `1` as potential start of a new match\n- Synchronous active-high reset, positive-edge triggered\n\nMealy machines produce output based on current state **and** current input — compare with the Moore FSM problem.",
        "constraints": "- Mealy machine: output depends on state AND current input\n- Overlapping detection",
        "starter_code": "module seq_det_1011(\n    input  clk, rst, din,\n    output reg detect\n);\n    // Define states S0..S4\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst,din; wire detect;\n    always #5 clk=~clk;\n    seq_det_1011 dut(.clk(clk),.rst(rst),.din(din),.detect(detect));\n    task send(input b); din=b; @(posedge clk); #1; endtask\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;send(1);send(0);send(1);send(1);$display(\"%b\",detect);", "expected_output": "1", "is_hidden": False},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;send(1);send(1);send(0);send(1);$display(\"%b\",detect);", "expected_output": "0", "is_hidden": False},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;send(1);send(0);send(1);send(1);send(0);send(1);send(1);$display(\"%b\",detect);", "expected_output": "1", "is_hidden": True},
        ],
    },
    {
        "title": "Parameterized Shift Register",
        "difficulty": "Medium",
        "domain": "RTL Design",
        "companies": ["Qualcomm", "Intel", "Broadcom"],
        "tags": ["sequential", "shift-register", "parameterized"],
        "description": "Design a **parameterized N-bit shift register** (SIPO — Serial-In Parallel-Out).\n\n**Parameters:**\n- `N`: shift register depth (default 4)\n\n**Ports:**\n- `clk`, `rst`: synchronous active-high reset (clears to 0)\n- `sin`: serial input — shifted in at MSB each clock\n- `q[N-1:0]`: parallel output\n\nOn each rising clock edge: `q <= {sin, q[N-1:1]}` — data shifts right, new bit enters at MSB.",
        "constraints": "- Must use `parameter N = 4`\n- Synchronous reset clears all bits to 0",
        "starter_code": "module shift_reg #(\n    parameter N = 4\n)(\n    input        clk, rst, sin,\n    output reg [N-1:0] q\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst,sin; wire [3:0] q;\n    always #5 clk=~clk;\n    shift_reg #(.N(4)) dut(.clk(clk),.rst(rst),.sin(sin),.q(q));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;sin=0;@(posedge clk);#1;rst=0;$display(\"%04b\",q);", "expected_output": "0000", "is_hidden": False},
            {"input_data": "rst=1;sin=0;@(posedge clk);#1;rst=0;sin=1;@(posedge clk);#1;$display(\"%04b\",q);", "expected_output": "1000", "is_hidden": False},
            {"input_data": "rst=1;sin=0;@(posedge clk);#1;rst=0;sin=1;@(posedge clk);#1;sin=0;@(posedge clk);#1;sin=1;@(posedge clk);#1;sin=1;@(posedge clk);#1;$display(\"%04b\",q);", "expected_output": "1011", "is_hidden": True},
        ],
    },
    {
        "title": "One-Hot State Encoding — Traffic Light FSM",
        "difficulty": "Hard",
        "domain": "RTL Design",
        "companies": ["NVIDIA", "Intel", "ARM", "Cadence"],
        "tags": ["sequential", "FSM", "one-hot", "encoding"],
        "description": "Design a **one-hot encoded** traffic light controller FSM.\n\n**States (one-hot):** RED, GREEN, YELLOW\n\n**State transitions** (on every rising clock edge, timer not modelled — just cycle through):\n- RED → GREEN → YELLOW → RED → ...\n\n**Ports:**\n- `clk`, `rst`: synchronous active-high reset → enters RED state\n- `red`, `green`, `yellow`: individual output bits (only one HIGH at a time)\n\n**Why one-hot?** In FPGAs the flip-flop density often makes one-hot encoding faster and smaller than binary.",
        "constraints": "- Must use one-hot state encoding (3-bit `state` register)\n- Exactly one output HIGH per cycle",
        "starter_code": "module traffic_fsm(\n    input  clk, rst,\n    output red, green, yellow\n);\n    // One-hot states: 3'b001=RED, 3'b010=GREEN, 3'b100=YELLOW\n    reg [2:0] state;\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst; wire red,green,yellow;\n    always #5 clk=~clk;\n    traffic_fsm dut(.clk(clk),.rst(rst),.red(red),.green(green),.yellow(yellow));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;$display(\"%b%b%b\",red,green,yellow);", "expected_output": "100", "is_hidden": False},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;@(posedge clk);#1;$display(\"%b%b%b\",red,green,yellow);", "expected_output": "010", "is_hidden": False},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;repeat(2)@(posedge clk);#1;$display(\"%b%b%b\",red,green,yellow);", "expected_output": "001", "is_hidden": False},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;repeat(3)@(posedge clk);#1;$display(\"%b%b%b\",red,green,yellow);", "expected_output": "100", "is_hidden": True},
        ],
    },
    # ── Design Verification — Hard ──────────────────────────────────────────────
    {
        "title": "Self-Checking Testbench for Synchronous FIFO",
        "difficulty": "Hard",
        "domain": "Design Verification",
        "companies": ["NVIDIA", "Intel", "Broadcom", "Cadence", "Synopsys"],
        "tags": ["testbench", "FIFO", "scoreboard", "self-checking"],
        "description": "Write a **self-checking testbench** for the `fifo4` module (depth=4, width=8) defined below.\n\nYour testbench must cover:\n1. **Write & read** a single value — verify data integrity\n2. **Fill to full** — verify `full` flag asserts\n3. **Drain to empty** — verify `empty` flag asserts and all data reads back in FIFO order\n4. **Overflow guard** — write when full should be silently ignored\n\nOutput a single line per scenario: `PASS` or `FAIL:<scenario>`.\n\n```verilog\nmodule fifo4(\n    input clk, rst, wr_en, rd_en,\n    input [7:0] din,\n    output reg [7:0] dout,\n    output full, empty\n);\n```\nThe DUT is compiled alongside your testbench.",
        "constraints": "- Must cover all 4 scenarios above\n- Use `$display` for each PASS/FAIL line\n- Use `$finish` to terminate",
        "starter_code": "`timescale 1ns/1ps\n// The fifo4 DUT is provided — do not redefine it\nmodule tb;\n    reg clk=0, rst, wr_en, rd_en;\n    reg [7:0] din;\n    wire [7:0] dout;\n    wire full, empty;\n\n    always #5 clk = ~clk;\n\n    fifo4 dut(\n        .clk(clk), .rst(rst),\n        .wr_en(wr_en), .rd_en(rd_en),\n        .din(din), .dout(dout),\n        .full(full), .empty(empty)\n    );\n\n    // Helper tasks\n    task do_reset;\n        rst=1; wr_en=0; rd_en=0;\n        @(posedge clk); #1; rst=0;\n    endtask\n\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        // TODO: implement scenarios\n        $finish;\n    end\nendmodule",
        "testbench_template": "module fifo4(\n    input clk, rst, wr_en, rd_en,\n    input [7:0] din,\n    output reg [7:0] dout,\n    output full, empty\n);\n    reg [7:0] mem [0:3];\n    reg [2:0] wr_ptr=0, rd_ptr=0, count=0;\n    assign full  = (count == 4);\n    assign empty = (count == 0);\n    always @(posedge clk) begin\n        if (rst) begin wr_ptr<=0; rd_ptr<=0; count<=0; dout<=0; end\n        else begin\n            if (wr_en && !full)  begin mem[wr_ptr[1:0]]<=din; wr_ptr<=wr_ptr+1; count<=count+1; end\n            if (rd_en && !empty) begin dout<=mem[rd_ptr[1:0]]; rd_ptr<=rd_ptr+1; count<=count-1; end\n        end\n    end\nendmodule\n{{INPUT}}",
        "testcases": [
            {"input_data": "// testbench is the submitted code", "expected_output": "PASS\nPASS\nPASS\nPASS", "is_hidden": False},
        ],
    },
    {
        "title": "Assertion-Based Verification — D Flip-Flop",
        "difficulty": "Medium",
        "domain": "Design Verification",
        "companies": ["Cadence", "Synopsys", "Intel", "NVIDIA"],
        "tags": ["SVA", "assertions", "formal", "flip-flop"],
        "description": "Write a testbench that uses **SystemVerilog Assertions (SVA)** to verify a D flip-flop.\n\nThe DUT is:\n```verilog\nmodule dff_sync(\n    input clk, rst, d,\n    output reg q\n);\n    always @(posedge clk)\n        q <= rst ? 0 : d;\nendmodule\n```\n\nYour testbench must include **3 concurrent assertions**:\n1. When `rst=1` on a rising edge, `q` must be 0 on the next cycle\n2. When `rst=0`, `q` on cycle N+1 must equal `d` on cycle N\n3. `q` must never be X or Z (no unknown outputs)\n\nRun at least 20 clock cycles of random stimulus. Output `ASSERT_PASS` if all assertions hold, `ASSERT_FAIL` if any fire.",
        "constraints": "- Must use SVA `property` and `assert property` syntax\n- Submit SystemVerilog (.sv syntax is accepted in Verilog mode with iverilog -g2012)",
        "starter_code": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0, rst, d;\n    wire q;\n    int fail_count = 0;\n\n    always #5 clk = ~clk;\n\n    dff_sync dut(.clk(clk),.rst(rst),.d(d),.q(q));\n\n    // TODO: add 3 concurrent SVA assertions here\n\n    // Stimulus\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        rst=1; d=0;\n        repeat(3) @(posedge clk);\n        rst=0;\n        repeat(20) begin\n            d=$random; @(posedge clk); #1;\n        end\n        if (fail_count == 0) $display(\"ASSERT_PASS\");\n        else $display(\"ASSERT_FAIL\");\n        $finish;\n    end\nendmodule",
        "testbench_template": "module dff_sync(\n    input clk, rst, d,\n    output reg q\n);\n    always @(posedge clk)\n        q <= rst ? 1'b0 : d;\nendmodule\n{{INPUT}}",
        "testcases": [
            {"input_data": "// assertions are in the submitted testbench", "expected_output": "ASSERT_PASS", "is_hidden": False},
        ],
    },
    # ── Debug & Analysis ────────────────────────────────────────────────────────
    {
        "title": "Debug: Fix the Latch (Incomplete Case)",
        "difficulty": "Easy",
        "domain": "Debug & Analysis",
        "companies": ["Intel", "Qualcomm", "ARM", "Cadence"],
        "tags": ["debug", "latch", "combinational", "common-bug"],
        "description": "The RTL below **infers a latch** — a common synthesis bug that causes timing closure nightmares.\n\n```verilog\nmodule decoder(\n    input  [1:0] sel,\n    output reg   out\n);\n    always @(*) begin\n        if      (sel == 2'b00) out = 1'b0;\n        else if (sel == 2'b01) out = 1'b1;\n        else if (sel == 2'b10) out = 1'b0;\n        // sel == 2'b11 is missing!\n    end\nendmodule\n```\n\n**Your task:** Fix the code so that `out=1` when `sel=2'b11`, and the design is **latch-free** (purely combinational).\n\nHint: Synthesis tools infer a latch whenever a register is not assigned in every branch of a combinational `always` block.",
        "constraints": "- Must be combinational (no latches)\n- All 4 input combinations must produce defined output",
        "starter_code": "module decoder(\n    input  [1:0] sel,\n    output reg   out\n);\n    always @(*) begin\n        if      (sel == 2'b00) out = 1'b0;\n        else if (sel == 2'b01) out = 1'b1;\n        else if (sel == 2'b10) out = 1'b0;\n        // Fix: handle sel == 2'b11\n    end\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg [1:0] sel; wire out;\n    decoder dut(.sel(sel),.out(out));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "sel=2'b00;#10;$display(\"%b\",out);", "expected_output": "0", "is_hidden": False},
            {"input_data": "sel=2'b01;#10;$display(\"%b\",out);", "expected_output": "1", "is_hidden": False},
            {"input_data": "sel=2'b10;#10;$display(\"%b\",out);", "expected_output": "0", "is_hidden": False},
            {"input_data": "sel=2'b11;#10;$display(\"%b\",out);", "expected_output": "1", "is_hidden": False},
        ],
    },
    {
        "title": "Debug: Fix the Race Condition (Non-Blocking Assignment)",
        "difficulty": "Easy",
        "domain": "Debug & Analysis",
        "companies": ["NVIDIA", "Intel", "Cadence", "Synopsys"],
        "tags": ["debug", "race-condition", "NBA", "flip-flop"],
        "description": "The swap circuit below has a **classic Verilog race condition** — it uses blocking assignments (`=`) inside a clocked `always` block.\n\n```verilog\nmodule swap(\n    input      clk,\n    input  [7:0] a_in, b_in,\n    output reg [7:0] a_out, b_out\n);\n    always @(posedge clk) begin\n        a_out = b_in;   // blocking!\n        b_out = a_in;   // a_in may already be overwritten\n    end\nendmodule\n```\n\nWith blocking assignments the order of statements matters — `a_out` gets `b_in` correctly, but `b_out` gets the **updated** `a_out` instead of the original `a_in`.\n\n**Your task:** Fix the swap so both outputs correctly capture the opposite input values in the same clock cycle.",
        "constraints": "- Use non-blocking assignments (`<=`)\n- Both outputs must update simultaneously",
        "starter_code": "module swap(\n    input      clk,\n    input  [7:0] a_in, b_in,\n    output reg [7:0] a_out, b_out\n);\n    always @(posedge clk) begin\n        a_out = b_in;   // BUG: blocking assignment\n        b_out = a_in;   // BUG: blocking assignment\n    end\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0; reg [7:0] a_in,b_in; wire [7:0] a_out,b_out;\n    always #5 clk=~clk;\n    swap dut(.clk(clk),.a_in(a_in),.b_in(b_in),.a_out(a_out),.b_out(b_out));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "a_in=8'hAA;b_in=8'hBB;@(posedge clk);#1;$display(\"%h %h\",a_out,b_out);", "expected_output": "bb aa", "is_hidden": False},
            {"input_data": "a_in=8'h12;b_in=8'h34;@(posedge clk);#1;$display(\"%h %h\",a_out,b_out);", "expected_output": "34 12", "is_hidden": False},
            {"input_data": "a_in=8'hFF;b_in=8'h00;@(posedge clk);#1;$display(\"%h %h\",a_out,b_out);", "expected_output": "00 ff", "is_hidden": True},
        ],
    },
    {
        "title": "Debug: Fix the Off-by-One in Counter Wrap",
        "difficulty": "Medium",
        "domain": "Debug & Analysis",
        "companies": ["Intel", "AMD", "Qualcomm", "Broadcom"],
        "tags": ["debug", "counter", "off-by-one", "sequential"],
        "description": "The modulo-6 counter below has an **off-by-one bug** — it wraps at 7 instead of 5.\n\n```verilog\nmodule mod6_counter(\n    input      clk, rst,\n    output reg [2:0] count\n);\n    always @(posedge clk) begin\n        if (rst)          count <= 0;\n        else if (count >= 6) count <= 0;  // BUG: should wrap at 5 (0..5 = 6 values)\n        else               count <= count + 1;\n    end\nendmodule\n```\n\n**Your task:** Fix the wrap condition so the counter cycles through values **0, 1, 2, 3, 4, 5, 0, 1, ...** (6 unique states).\n\nOff-by-one errors in modulo counters are a notorious source of bugs in clock dividers and address generators.",
        "constraints": "- Counter must cycle 0 through 5 (inclusive)\n- Synchronous reset returns to 0",
        "starter_code": "module mod6_counter(\n    input      clk, rst,\n    output reg [2:0] count\n);\n    always @(posedge clk) begin\n        if (rst)          count <= 0;\n        else if (count >= 6) count <= 0;  // Fix this condition\n        else               count <= count + 1;\n    end\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst; wire [2:0] count;\n    always #5 clk=~clk;\n    mod6_counter dut(.clk(clk),.rst(rst),.count(count));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;repeat(5)@(posedge clk);#1;$display(\"%0d\",count);", "expected_output": "5", "is_hidden": False},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;repeat(6)@(posedge clk);#1;$display(\"%0d\",count);", "expected_output": "0", "is_hidden": False},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;repeat(7)@(posedge clk);#1;$display(\"%0d\",count);", "expected_output": "1", "is_hidden": True},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;repeat(12)@(posedge clk);#1;$display(\"%0d\",count);", "expected_output": "0", "is_hidden": True},
        ],
    },
    {
        "title": "Debug: Fix the Glitchy Output (Missing Sensitivity List)",
        "difficulty": "Medium",
        "domain": "Debug & Analysis",
        "companies": ["Cadence", "Synopsys", "Intel", "Qualcomm"],
        "tags": ["debug", "sensitivity-list", "combinational", "simulation"],
        "description": "The combinational adder below **misses signals in its sensitivity list** — a common Verilog-2001 pitfall.\n\n```verilog\nmodule add_carry(\n    input  [3:0] a, b,\n    input        cin,\n    output reg [3:0] sum,\n    output reg       cout\n);\n    always @(a) begin  // BUG: b and cin not in sensitivity list\n        {cout, sum} = a + b + cin;\n    end\nendmodule\n```\n\nIn simulation, the `always` block won't re-evaluate when `b` or `cin` change — producing stale outputs. Synthesis ignores sensitivity lists and infers logic correctly, but the simulation mismatch causes sign-off failures.\n\n**Your task:** Fix the sensitivity list so the always block triggers on any input change.",
        "constraints": "- Use `always @(*)` or explicitly list all inputs\n- Purely combinational",
        "starter_code": "module add_carry(\n    input  [3:0] a, b,\n    input        cin,\n    output reg [3:0] sum,\n    output reg       cout\n);\n    always @(a) begin  // Fix: incomplete sensitivity list\n        {cout, sum} = a + b + cin;\n    end\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg [3:0] a,b; reg cin; wire [3:0] sum; wire cout;\n    add_carry dut(.a(a),.b(b),.cin(cin),.sum(sum),.cout(cout));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "a=4'd3;b=4'd5;cin=0;#10;$display(\"%0d %b\",sum,cout);", "expected_output": "8 0", "is_hidden": False},
            {"input_data": "a=4'd7;b=4'd9;cin=1;#10;$display(\"%0d %b\",sum,cout);", "expected_output": "1 1", "is_hidden": False},
            {"input_data": "a=4'd0;b=4'd0;cin=0;#5;b=4'd15;#10;$display(\"%0d\",sum);", "expected_output": "15", "is_hidden": True},
        ],
    },
    {
        "title": "Debug: Fix the FSM Reset State",
        "difficulty": "Hard",
        "domain": "Debug & Analysis",
        "companies": ["NVIDIA", "Intel", "ARM", "Qualcomm"],
        "tags": ["debug", "FSM", "reset", "one-hot"],
        "description": "The Mealy FSM below detects `10` on input `din` but **resets to an invalid state** — `state` is set to `3'b000` on reset, which matches none of the one-hot states, causing the FSM to hang in an unreachable state after reset.\n\n```verilog\nmodule det10(\n    input  clk, rst, din,\n    output reg detect\n);\n    localparam S0=3'b001, S1=3'b010, S2=3'b100;\n    reg [2:0] state;\n    always @(posedge clk) begin\n        if (rst) state <= 3'b000;  // BUG: not a valid one-hot state\n        else case (state)\n            S0: state <= din ? S1 : S0;\n            S1: state <= din ? S1 : S2;\n            S2: state <= din ? S1 : S0;\n            default: state <= 3'b000;\n        endcase\n    end\n    always @(*) detect = (state==S2) && !din;\nendmodule\n```\n\n**Your task:** Fix the reset so the FSM starts in a valid one-hot state (`S0`), and verify `detect` pulses correctly.",
        "constraints": "- Reset must land in a valid one-hot state\n- Do not change the state encoding constants",
        "starter_code": "module det10(\n    input  clk, rst, din,\n    output reg detect\n);\n    localparam S0=3'b001, S1=3'b010, S2=3'b100;\n    reg [2:0] state;\n    always @(posedge clk) begin\n        if (rst) state <= 3'b000;  // Fix this line\n        else case (state)\n            S0: state <= din ? S1 : S0;\n            S1: state <= din ? S1 : S2;\n            S2: state <= din ? S1 : S0;\n            default: state <= S0;\n        endcase\n    end\n    always @(*) detect = (state==S2) && !din;\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst,din; wire detect;\n    always #5 clk=~clk;\n    det10 dut(.clk(clk),.rst(rst),.din(din),.detect(detect));\n    task send(input b); din=b; @(posedge clk); #1; endtask\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;send(1);send(0);$display(\"%b\",detect);", "expected_output": "1", "is_hidden": False},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;send(0);send(0);$display(\"%b\",detect);", "expected_output": "0", "is_hidden": False},
            {"input_data": "rst=1;@(posedge clk);#1;rst=0;send(1);send(1);send(0);$display(\"%b\",detect);", "expected_output": "1", "is_hidden": True},
        ],
    },
    # ── Computer Architecture — More ────────────────────────────────────────────
    {
        "title": "Program Counter (PC) with Load",
        "difficulty": "Easy",
        "domain": "Computer Architecture",
        "companies": ["ARM", "NVIDIA", "Intel", "AMD"],
        "tags": ["sequential", "program-counter", "datapath"],
        "description": "Implement an 8-bit **Program Counter (PC)** — the register that holds the address of the next instruction.\n\n**Ports:**\n- `clk`, `rst`: synchronous active-high reset (PC → 0)\n- `en`: increment enable — PC += 1 each cycle when HIGH\n- `load`: load enable — when HIGH, load `pc_in` into PC (overrides `en`)\n- `pc_in[7:0]`: data to load (e.g., branch target)\n- `pc[7:0]`: current PC value\n\n**Priority:** `load` > `en` > hold",
        "constraints": "- Synchronous operation\n- `load` takes priority over `en`",
        "starter_code": "module prog_counter(\n    input        clk, rst, en, load,\n    input  [7:0] pc_in,\n    output reg [7:0] pc\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,rst,en,load; reg [7:0] pc_in; wire [7:0] pc;\n    always #5 clk=~clk;\n    prog_counter dut(.clk(clk),.rst(rst),.en(en),.load(load),.pc_in(pc_in),.pc(pc));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1;en=0;load=0;pc_in=0;@(posedge clk);#1;rst=0;en=1;repeat(3)@(posedge clk);#1;$display(\"%0d\",pc);", "expected_output": "3", "is_hidden": False},
            {"input_data": "rst=1;en=0;load=0;pc_in=0;@(posedge clk);#1;rst=0;en=1;repeat(3)@(posedge clk);#1;load=1;pc_in=8'd50;@(posedge clk);#1;$display(\"%0d\",pc);", "expected_output": "50", "is_hidden": False},
            {"input_data": "rst=1;en=0;load=0;pc_in=0;@(posedge clk);#1;rst=0;load=1;pc_in=8'hFF;en=1;@(posedge clk);#1;$display(\"%0d\",pc);", "expected_output": "255", "is_hidden": True},
        ],
    },
    {
        "title": "Single-Port RAM (8×8)",
        "difficulty": "Medium",
        "domain": "Computer Architecture",
        "companies": ["NVIDIA", "Intel", "ARM", "Marvell"],
        "tags": ["memory", "RAM", "synchronous-write"],
        "description": "Implement a **single-port synchronous-write, asynchronous-read RAM** with 8 locations × 8 bits.\n\n**Ports:**\n- `clk`\n- `we`: write enable\n- `addr[2:0]`: address (0–7)\n- `din[7:0]`: write data\n- `dout[7:0]`: read data (combinational — no clock needed for reads)\n\n**Behaviour:**\n- Write: on rising clock edge when `we=1`, `mem[addr] <= din`\n- Read: `dout = mem[addr]` immediately (asynchronous)\n\nThis is the standard inferred-RAM template accepted by all major synthesis tools.",
        "constraints": "- Synchronous write, asynchronous read\n- 8 addresses × 8 bits",
        "starter_code": "module ram8x8(\n    input        clk, we,\n    input  [2:0] addr,\n    input  [7:0] din,\n    output [7:0] dout\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg clk=0,we; reg [2:0] addr; reg [7:0] din; wire [7:0] dout;\n    always #5 clk=~clk;\n    ram8x8 dut(.clk(clk),.we(we),.addr(addr),.din(din),.dout(dout));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "we=1;addr=3'd3;din=8'hCA;@(posedge clk);#1;we=0;addr=3'd3;#1;$display(\"%h\",dout);", "expected_output": "ca", "is_hidden": False},
            {"input_data": "we=1;addr=3'd0;din=8'hAA;@(posedge clk);#1;addr=3'd1;din=8'hBB;@(posedge clk);#1;we=0;addr=3'd0;#1;$display(\"%h\",dout);", "expected_output": "aa", "is_hidden": False},
            {"input_data": "we=1;addr=3'd7;din=8'hDE;@(posedge clk);#1;we=1;addr=3'd7;din=8'hAD;@(posedge clk);#1;we=0;addr=3'd7;#1;$display(\"%h\",dout);", "expected_output": "ad", "is_hidden": True},
        ],
    },
    {
        "title": "Instruction Decoder (3-op RISC)",
        "difficulty": "Hard",
        "domain": "Computer Architecture",
        "companies": ["ARM", "NVIDIA", "Intel", "AMD", "Qualcomm"],
        "tags": ["combinational", "decoder", "ISA", "datapath"],
        "description": "Implement a combinational **instruction decoder** for a minimal 8-bit RISC ISA.\n\n**Instruction format (8 bits):** `[7:6]=opcode`, `[5:3]=rs1`, `[2:0]=rs2/imm`\n\n| opcode | Mnemonic | Operation |\n|--------|----------|-----------|\n| 2'b00  | ADD      | alu_op=2'b00, use_imm=0 |\n| 2'b01  | SUB      | alu_op=2'b01, use_imm=0 |\n| 2'b10  | ADDI     | alu_op=2'b00, use_imm=1 |\n| 2'b11  | LOAD     | mem_read=1, alu_op=2'b00 |\n\n**Ports:**\n- `instr[7:0]`: instruction word\n- `opcode[1:0]`, `rs1[2:0]`, `rs2_imm[2:0]`: decoded fields\n- `alu_op[1:0]`: ALU operation to perform\n- `use_imm`: treat `rs2_imm` as immediate value\n- `mem_read`: memory read operation",
        "constraints": "- Purely combinational\n- All outputs must be assigned for every opcode",
        "starter_code": "module instr_dec(\n    input  [7:0] instr,\n    output [1:0] opcode,\n    output [2:0] rs1,\n    output [2:0] rs2_imm,\n    output reg [1:0] alu_op,\n    output reg use_imm,\n    output reg mem_read\n);\n    // Field extraction\n    assign opcode  = instr[7:6];\n    assign rs1     = instr[5:3];\n    assign rs2_imm = instr[2:0];\n\n    // Control signal generation\n    always @(*) begin\n        // Your code here\n    end\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb;\n    reg [7:0] instr;\n    wire [1:0] opcode; wire [2:0] rs1,rs2_imm;\n    wire [1:0] alu_op; wire use_imm,mem_read;\n    instr_dec dut(.instr(instr),.opcode(opcode),.rs1(rs1),.rs2_imm(rs2_imm),.alu_op(alu_op),.use_imm(use_imm),.mem_read(mem_read));\n    initial begin\n        $dumpfile(\"waveform.vcd\"); $dumpvars(0,tb);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "instr=8'b00_010_011;#10;$display(\"%b %b %b\",alu_op,use_imm,mem_read);", "expected_output": "00 0 0", "is_hidden": False},
            {"input_data": "instr=8'b01_001_100;#10;$display(\"%b %b %b\",alu_op,use_imm,mem_read);", "expected_output": "01 0 0", "is_hidden": False},
            {"input_data": "instr=8'b10_011_101;#10;$display(\"%b %b %b\",alu_op,use_imm,mem_read);", "expected_output": "00 1 0", "is_hidden": False},
            {"input_data": "instr=8'b11_100_010;#10;$display(\"%b %b %b\",alu_op,use_imm,mem_read);", "expected_output": "00 0 1", "is_hidden": True},
        ],
    },
]

SEED_PROBLEMS = [
    {
        "title": "Half Adder",
        "difficulty": "Easy",
        "domain": "RTL Design",
        "companies": ["Intel", "Qualcomm"],
        "tags": ["combinational", "arithmetic"],
        "description": "Design a half adder with inputs `a`, `b` and outputs `sum`, `carry`.\n\n**Truth Table:**\n| a | b | sum | carry |\n|---|---|-----|-------|\n| 0 | 0 |  0  |   0   |\n| 0 | 1 |  1  |   0   |\n| 1 | 0 |  1  |   0   |\n| 1 | 1 |  0  |   1   |",
        "constraints": "- Use only combinational logic\n- No clock or reset required",
        "starter_code": "module half_adder(\n    input  a,\n    input  b,\n    output sum,\n    output carry\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb_half_adder;\n    reg a, b;\n    wire sum, carry;\n    half_adder dut(.a(a), .b(b), .sum(sum), .carry(carry));\n    initial begin\n        $dumpfile(\"waveform.vcd\");\n        $dumpvars(0, tb_half_adder);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "a=0; b=0; #10; $display(\"%b %b\", sum, carry);", "expected_output": "0 0", "is_hidden": False},
            {"input_data": "a=0; b=1; #10; $display(\"%b %b\", sum, carry);", "expected_output": "1 0", "is_hidden": False},
            {"input_data": "a=1; b=0; #10; $display(\"%b %b\", sum, carry);", "expected_output": "1 0", "is_hidden": False},
            {"input_data": "a=1; b=1; #10; $display(\"%b %b\", sum, carry);", "expected_output": "0 1", "is_hidden": True},
        ]
    },
    {
        "title": "2-to-1 Multiplexer",
        "difficulty": "Easy",
        "domain": "RTL Design",
        "companies": ["Qualcomm", "AMD"],
        "tags": ["combinational", "mux"],
        "description": "Implement a 2-to-1 multiplexer.\n- When `sel=0`, output `a`\n- When `sel=1`, output `b`",
        "constraints": "- Single-bit inputs and output",
        "starter_code": "module mux2to1(\n    input  a,\n    input  b,\n    input  sel,\n    output out\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb_mux2to1;\n    reg a, b, sel;\n    wire out;\n    mux2to1 dut(.a(a), .b(b), .sel(sel), .out(out));\n    initial begin\n        $dumpfile(\"waveform.vcd\");\n        $dumpvars(0, tb_mux2to1);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "a=1; b=0; sel=0; #10; $display(\"%b\", out);", "expected_output": "1", "is_hidden": False},
            {"input_data": "a=1; b=0; sel=1; #10; $display(\"%b\", out);", "expected_output": "0", "is_hidden": False},
            {"input_data": "a=0; b=1; sel=1; #10; $display(\"%b\", out);", "expected_output": "1", "is_hidden": True},
        ]
    },
    {
        "title": "D Flip-Flop (Sync Reset)",
        "difficulty": "Medium",
        "domain": "RTL Design",
        "companies": ["NVIDIA", "Intel", "ARM"],
        "tags": ["sequential", "flip-flop"],
        "description": "Design a positive-edge-triggered D flip-flop with **synchronous active-high reset**.\n\n- On rising clock edge: if `rst=1`, set `q=0`; else `q=d`",
        "constraints": "- Synchronous reset only\n- Positive edge triggered",
        "starter_code": "module dff_sync(\n    input  clk,\n    input  rst,\n    input  d,\n    output reg q\n);\n    // Your code here\nendmodule",
        "testbench_template": "`timescale 1ns/1ps\nmodule tb_dff_sync;\n    reg clk=0, rst, d;\n    wire q;\n    always #5 clk = ~clk;\n    dff_sync dut(.clk(clk), .rst(rst), .d(d), .q(q));\n    initial begin\n        $dumpfile(\"waveform.vcd\");\n        $dumpvars(0, tb_dff_sync);\n        {{INPUT}}\n        $finish;\n    end\nendmodule",
        "testcases": [
            {"input_data": "rst=1; d=1; @(posedge clk); #1; $display(\"%b\", q);", "expected_output": "0", "is_hidden": False},
            {"input_data": "rst=0; d=1; @(posedge clk); #1; $display(\"%b\", q);", "expected_output": "1", "is_hidden": False},
            {"input_data": "rst=0; d=0; @(posedge clk); #1; $display(\"%b\", q);", "expected_output": "0", "is_hidden": True},
        ]
    },
]

@api_router.post("/seed")
async def seed_database(request: Request):
    """One-time seed endpoint. Protected by SEED_SECRET env var. No-ops if data already exists."""
    seed_secret = os.environ.get("SEED_SECRET", "")
    if not seed_secret:
        raise HTTPException(status_code=403, detail="Seed endpoint disabled")
    provided = request.headers.get("X-Seed-Secret", "")
    if provided != seed_secret:
        raise HTTPException(status_code=403, detail="Invalid seed secret")

    results = []

    # Create admin user if not exists
    admin_email = "admin@vlsiweb.com"
    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        hashed = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": admin_email,
            "name": "Admin",
            "password_hash": hashed,
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        results.append("created admin user: admin@vlsiweb.com / admin123")
    else:
        results.append("admin user already exists")

    # Seed sample problems
    for prob in SEED_PROBLEMS:
        existing = await db.problems.find_one({"title": prob["title"]})
        if not existing:
            now = datetime.now(timezone.utc).isoformat()
            testcases = [{"testcase_id": f"tc_{uuid.uuid4().hex[:8]}", **tc} for tc in prob["testcases"]]
            prob_doc = {k: v for k, v in prob.items() if k != "testcases"}
            await db.problems.insert_one({
                "problem_id": f"prob_{uuid.uuid4().hex[:12]}",
                "testcases": testcases,
                "created_by": "admin",
                "created_at": now,
                "updated_at": now,
                **prob_doc
            })
            results.append(f"seeded problem: {prob['title']}")
        else:
            results.append(f"problem already exists: {prob['title']}")

    # Ensure indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.problems.create_index("problem_id", unique=True)
    await db.submissions.create_index([("user_id", 1), ("submitted_at", -1)])
    await db.user_sessions.create_index("session_token")
    results.append("indexes ensured")

    return {"status": "ok", "results": results}


# ==================== HEALTH CHECK ====================

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/debug/test-simulation")
async def test_simulation():
    """
    Test endpoint: runs a known-correct half_adder simulation.
    Returns detailed diagnostics — useful for verifying the iverilog/vvp pipeline.
    """
    import shutil as _shutil

    # Check binaries are findable
    iverilog_path = _shutil.which("iverilog")
    vvp_path = _shutil.which("vvp")

    design = """\
module half_adder(input a, input b, output sum, output carry);
  assign sum   = a ^ b;
  assign carry = a & b;
endmodule
"""
    testbench = """\
module testbench;
  reg a, b;
  wire sum, carry;
  half_adder uut(.a(a), .b(b), .sum(sum), .carry(carry));
  initial begin
    $dumpfile("waveform.vcd");
    $dumpvars(0, testbench);
    a = 1; b = 1; #5;
    $display("%b %b", sum, carry);
    #10 $finish;
  end
endmodule
"""
    result = await compile_and_simulate_verilog(design, testbench, "verilog")
    return {
        "iverilog_path": iverilog_path,
        "vvp_path": vvp_path,
        "simulation_success": result["success"],
        "simulation_output": result.get("output"),
        "simulation_error": result.get("error"),
        "has_vcd": result.get("vcd_data") is not None,
    }


# ==================== MIDDLEWARE & ROUTER ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
