"""
VLSI Forge — Database Seeder for MongoDB Atlas
Run this ONCE after pointing .env at your Atlas cluster.

Usage:
  cd /opt/vlsiforge
  source venv/bin/activate
  python3 deploy/seed_atlas.py
"""

import asyncio
import os
import uuid
import bcrypt
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME   = os.environ.get("DB_NAME", "vlsiforge")

SAMPLE_PROBLEMS = [
    {
        "title": "Half Adder",
        "difficulty": "Easy",
        "tags": ["combinational", "arithmetic"],
        "description": "Design a half adder with inputs `a`, `b` and outputs `sum`, `carry`.\n\n**Truth Table:**\n| a | b | sum | carry |\n|---|---|-----|-------|\n| 0 | 0 |  0  |   0   |\n| 0 | 1 |  1  |   0   |\n| 1 | 0 |  1  |   0   |\n| 1 | 1 |  0  |   1   |",
        "constraints": "- Use only combinational logic\n- No clock or reset required",
        "starter_code": "module half_adder(\n    input  a,\n    input  b,\n    output sum,\n    output carry\n);\n    // Your code here\nendmodule",
        "testbench_template": """`timescale 1ns/1ps
module tb_half_adder;
    reg a, b;
    wire sum, carry;
    half_adder dut(.a(a), .b(b), .sum(sum), .carry(carry));
    initial begin
        $dumpfile("waveform.vcd");
        $dumpvars(0, tb_half_adder);
        {{INPUT}}
        $finish;
    end
endmodule""",
        "testcases": [
            {"input_data": "a=0; b=0; #10; $display(\"%b %b\", sum, carry);",
             "expected_output": "0 0", "is_hidden": False},
            {"input_data": "a=0; b=1; #10; $display(\"%b %b\", sum, carry);",
             "expected_output": "1 0", "is_hidden": False},
            {"input_data": "a=1; b=0; #10; $display(\"%b %b\", sum, carry);",
             "expected_output": "1 0", "is_hidden": False},
            {"input_data": "a=1; b=1; #10; $display(\"%b %b\", sum, carry);",
             "expected_output": "0 1", "is_hidden": True},
        ]
    },
    {
        "title": "2-to-1 Multiplexer",
        "difficulty": "Easy",
        "tags": ["combinational", "mux"],
        "description": "Implement a 2-to-1 multiplexer.\n- When `sel=0`, output `a`\n- When `sel=1`, output `b`",
        "constraints": "- Single-bit inputs and output",
        "starter_code": "module mux2to1(\n    input  a,\n    input  b,\n    input  sel,\n    output out\n);\n    // Your code here\nendmodule",
        "testbench_template": """`timescale 1ns/1ps
module tb_mux2to1;
    reg a, b, sel;
    wire out;
    mux2to1 dut(.a(a), .b(b), .sel(sel), .out(out));
    initial begin
        $dumpfile("waveform.vcd");
        $dumpvars(0, tb_mux2to1);
        {{INPUT}}
        $finish;
    end
endmodule""",
        "testcases": [
            {"input_data": "a=1; b=0; sel=0; #10; $display(\"%b\", out);",
             "expected_output": "1", "is_hidden": False},
            {"input_data": "a=1; b=0; sel=1; #10; $display(\"%b\", out);",
             "expected_output": "0", "is_hidden": False},
            {"input_data": "a=0; b=1; sel=1; #10; $display(\"%b\", out);",
             "expected_output": "1", "is_hidden": True},
        ]
    },
    {
        "title": "D Flip-Flop (Sync Reset)",
        "difficulty": "Medium",
        "tags": ["sequential", "flip-flop"],
        "description": "Design a positive-edge-triggered D flip-flop with **synchronous active-high reset**.\n\n- On rising clock edge: if `rst=1`, set `q=0`; else `q=d`",
        "constraints": "- Synchronous reset only\n- Positive edge triggered",
        "starter_code": "module dff_sync(\n    input  clk,\n    input  rst,\n    input  d,\n    output reg q\n);\n    // Your code here\nendmodule",
        "testbench_template": """`timescale 1ns/1ps
module tb_dff_sync;
    reg clk=0, rst, d;
    wire q;
    always #5 clk = ~clk;
    dff_sync dut(.clk(clk), .rst(rst), .d(d), .q(q));
    initial begin
        $dumpfile("waveform.vcd");
        $dumpvars(0, tb_dff_sync);
        {{INPUT}}
        $finish;
    end
endmodule""",
        "testcases": [
            {"input_data": "rst=1; d=1; @(posedge clk); #1; $display(\"%b\", q);",
             "expected_output": "0", "is_hidden": False},
            {"input_data": "rst=0; d=1; @(posedge clk); #1; $display(\"%b\", q);",
             "expected_output": "1", "is_hidden": False},
            {"input_data": "rst=0; d=0; @(posedge clk); #1; $display(\"%b\", q);",
             "expected_output": "0", "is_hidden": True},
        ]
    },
]


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"Connected to MongoDB Atlas → database: {DB_NAME}")

    # Create admin user
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
        print("✓ Admin user created: admin@vlsiweb.com / admin123")
    else:
        print("✓ Admin user already exists")

    # Seed sample problems
    for prob in SAMPLE_PROBLEMS:
        existing = await db.problems.find_one({"title": prob["title"]})
        if not existing:
            now = datetime.now(timezone.utc).isoformat()
            testcases = []
            for tc in prob.pop("testcases"):
                testcases.append({
                    "testcase_id": f"tc_{uuid.uuid4().hex[:8]}",
                    **tc
                })
            await db.problems.insert_one({
                "problem_id": f"prob_{uuid.uuid4().hex[:12]}",
                "testcases": testcases,
                "created_by": "admin",
                "created_at": now,
                "updated_at": now,
                **prob
            })
            print(f"✓ Problem seeded: {prob['title']}")
        else:
            print(f"  (skipped) Problem already exists: {prob['title']}")

    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.problems.create_index("problem_id", unique=True)
    await db.submissions.create_index([("user_id", 1), ("submitted_at", -1)])
    await db.user_sessions.create_index("session_token")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    print("✓ Database indexes created")

    client.close()
    print("\nSeed complete! You can now log in at https://vlsiweb.com")
    print("  Admin:  admin@vlsiweb.com / admin123")
    print("  ⚠  Change the admin password after first login!")


asyncio.run(seed())
