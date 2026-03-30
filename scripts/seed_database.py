#!/usr/bin/env python3
"""
Seed script to populate the database with sample problems and an admin user
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid
import bcrypt
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

async def seed_database():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🌱 Seeding database...")
    
    # Create admin user
    admin_email = "admin@vlsiweb.com"
    existing_admin = await db.users.find_one({"email": admin_email})
    
    if not existing_admin:
        admin_password = bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode()
        admin_id = f"user_{uuid.uuid4().hex[:12]}"
        
        await db.users.insert_one({
            "user_id": admin_id,
            "email": admin_email,
            "name": "Admin User",
            "password_hash": admin_password,
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        print(f"✅ Created admin user: {admin_email} / admin123")
    else:
        print(f"ℹ️  Admin user already exists: {admin_email}")
    
    # Sample problems
    problems = [
        {
            "title": "Half Adder",
            "description": """Design a half adder circuit in Verilog.

A half adder adds two single binary digits A and B. It has two outputs: sum (S) and carry (C).

Truth Table:
A | B | S | C
0 | 0 | 0 | 0
0 | 1 | 1 | 0
1 | 0 | 1 | 0
1 | 1 | 0 | 1

Implement a module named 'half_adder' with inputs a, b and outputs sum, carry.""",
            "difficulty": "Easy",
            "tags": ["Combinational", "Adder", "Basic"],
            "constraints": "Use basic logic gates (AND, XOR)",
            "starter_code": """module half_adder(
    input a,
    input b,
    output sum,
    output carry
);

// Your code here

endmodule""",
            "testbench_template": """module testbench;
    reg a, b;
    wire sum, carry;
    
    half_adder uut(.a(a), .b(b), .sum(sum), .carry(carry));
    
    initial begin
        $dumpfile("waveform.vcd");
        $dumpvars(0, testbench);
        
        {{INPUT}}
        
        #10 $finish;
    end
endmodule""",
            "testcases": [
                {
                    "testcase_id": "tc_ha_1",
                    "input_data": "a = 0; b = 0; #5; $display(\"%b %b\", sum, carry);",
                    "expected_output": "0 0",
                    "is_hidden": False
                },
                {
                    "testcase_id": "tc_ha_2",
                    "input_data": "a = 0; b = 1; #5; $display(\"%b %b\", sum, carry);",
                    "expected_output": "1 0",
                    "is_hidden": False
                },
                {
                    "testcase_id": "tc_ha_3",
                    "input_data": "a = 1; b = 0; #5; $display(\"%b %b\", sum, carry);",
                    "expected_output": "1 0",
                    "is_hidden": True
                },
                {
                    "testcase_id": "tc_ha_4",
                    "input_data": "a = 1; b = 1; #5; $display(\"%b %b\", sum, carry);",
                    "expected_output": "0 1",
                    "is_hidden": True
                }
            ]
        },
        {
            "title": "2-to-1 Multiplexer",
            "description": """Design a 2-to-1 multiplexer in Verilog.

A multiplexer (MUX) selects one of several input signals and forwards the selected input to a single output line.

Truth Table:
sel | out
0   | a
1   | b

Implement a module named 'mux_2to1' with inputs a, b, sel and output out.""",
            "difficulty": "Easy",
            "tags": ["Combinational", "MUX", "Basic"],
            "constraints": "Use conditional operator or case statement",
            "starter_code": """module mux_2to1(
    input a,
    input b,
    input sel,
    output out
);

// Your code here

endmodule""",
            "testbench_template": """module testbench;
    reg a, b, sel;
    wire out;
    
    mux_2to1 uut(.a(a), .b(b), .sel(sel), .out(out));
    
    initial begin
        $dumpfile("waveform.vcd");
        $dumpvars(0, testbench);
        
        {{INPUT}}
        
        #10 $finish;
    end
endmodule""",
            "testcases": [
                {
                    "testcase_id": "tc_mux_1",
                    "input_data": "a = 1; b = 0; sel = 0; #5; $display(\"%b\", out);",
                    "expected_output": "1",
                    "is_hidden": False
                },
                {
                    "testcase_id": "tc_mux_2",
                    "input_data": "a = 1; b = 0; sel = 1; #5; $display(\"%b\", out);",
                    "expected_output": "0",
                    "is_hidden": False
                },
                {
                    "testcase_id": "tc_mux_3",
                    "input_data": "a = 0; b = 1; sel = 0; #5; $display(\"%b\", out);",
                    "expected_output": "0",
                    "is_hidden": True
                },
                {
                    "testcase_id": "tc_mux_4",
                    "input_data": "a = 0; b = 1; sel = 1; #5; $display(\"%b\", out);",
                    "expected_output": "1",
                    "is_hidden": True
                }
            ]
        },
        {
            "title": "D Flip-Flop",
            "description": """Design a positive edge-triggered D flip-flop in Verilog.

A D flip-flop captures the value of the D input at a definite portion of the clock cycle (such as the rising edge).

Implement a module named 'd_ff' with inputs clk, d, reset and output q.
- On reset (active high), q should be 0
- On positive edge of clk, q should capture the value of d""",
            "difficulty": "Medium",
            "tags": ["Sequential", "Flip-Flop", "Storage"],
            "constraints": "Use always block with posedge clk",
            "starter_code": """module d_ff(
    input clk,
    input d,
    input reset,
    output reg q
);

// Your code here

endmodule""",
            "testbench_template": """module testbench;
    reg clk, d, reset;
    wire q;
    
    d_ff uut(.clk(clk), .d(d), .reset(reset), .q(q));
    
    initial clk = 0;
    always #5 clk = ~clk;
    
    initial begin
        $dumpfile("waveform.vcd");
        $dumpvars(0, testbench);
        
        {{INPUT}}
        
        #50 $finish;
    end
endmodule""",
            "testcases": [
                {
                    "testcase_id": "tc_dff_1",
                    "input_data": "reset = 1; d = 0; #10; reset = 0; #1; $display(\"%b\", q);",
                    "expected_output": "0",
                    "is_hidden": False
                },
                {
                    "testcase_id": "tc_dff_2",
                    "input_data": "reset = 1; d = 0; #10; reset = 0; d = 1; #10; $display(\"%b\", q);",
                    "expected_output": "1",
                    "is_hidden": False
                },
                {
                    "testcase_id": "tc_dff_3",
                    "input_data": "reset = 1; #10; reset = 0; d = 1; #10; d = 0; #10; $display(\"%b\", q);",
                    "expected_output": "0",
                    "is_hidden": True
                }
            ]
        }
    ]
    
    # Insert problems
    for problem_data in problems:
        existing = await db.problems.find_one({"title": problem_data["title"]})
        if not existing:
            problem_id = f"prob_{uuid.uuid4().hex[:12]}"
            now = datetime.now(timezone.utc).isoformat()
            
            problem_doc = {
                "problem_id": problem_id,
                "title": problem_data["title"],
                "description": problem_data["description"],
                "difficulty": problem_data["difficulty"],
                "tags": problem_data["tags"],
                "constraints": problem_data["constraints"],
                "starter_code": problem_data["starter_code"],
                "testbench_template": problem_data["testbench_template"],
                "testcases": problem_data["testcases"],
                "created_by": "system",
                "created_at": now,
                "updated_at": now
            }
            
            await db.problems.insert_one(problem_doc)
            print(f"✅ Created problem: {problem_data['title']}")
        else:
            print(f"ℹ️  Problem already exists: {problem_data['title']}")
    
    client.close()
    print("\n🎉 Database seeding completed!")
    print("\n📝 Login credentials:")
    print(f"   Email: admin@vlsiweb.com")
    print(f"   Password: admin123")

if __name__ == "__main__":
    asyncio.run(seed_database())
