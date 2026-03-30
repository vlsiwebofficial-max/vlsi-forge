#!/usr/bin/env python3
"""
Bulk add all 50 RTL problems to VLSI Forge via Admin API
"""
import requests
import json

API_URL = "https://rtl-leetcode.preview.emergentagent.com/api"

# Login as admin
print("🔐 Logging in as admin...")
login_response = requests.post(
    f"{API_URL}/auth/login",
    json={"email": "admin@vlsiweb.com", "password": "admin123"}
)

cookies = login_response.cookies

# Problem templates with realistic Verilog code
PROBLEMS_DATA = [
    # EASY PROBLEMS (5-15)
    {
        "title": "8-bit Comparator",
        "difficulty": "Easy",
        "tags": ["Combinational", "Comparator"],
        "description": """Design an 8-bit magnitude comparator.

Compare two 8-bit numbers and produce three outputs:
- eq: a == b
- gt: a > b  
- lt: a < b

Module: comparator_8bit(a[7:0], b[7:0], eq, gt, lt)""",
        "constraints": "Use relational operators",
        "starter_code": """module comparator_8bit(
    input [7:0] a,
    input [7:0] b,
    output eq, gt, lt
);

// Your code here

endmodule""",
        "testbench_template": """module testbench;
    reg [7:0] a, b;
    wire eq, gt, lt;
    
    comparator_8bit uut(.a(a), .b(b), .eq(eq), .gt(gt), .lt(lt));
    
    initial begin
        $dumpfile("waveform.vcd");
        $dumpvars(0, testbench);
        {{INPUT}}
        #10 $finish;
    end
endmodule"""
    },
    {
        "title": "8-bit Parity Generator",
        "difficulty": "Easy",
        "tags": ["Combinational", "Parity"],
        "description": """Design an 8-bit even parity generator.

Generate even parity bit for 8-bit input data.
Parity bit = XOR of all input bits

Module: parity_gen(data[7:0], parity)""",
        "constraints": "Use XOR reduction operator",
        "starter_code": """module parity_gen(
    input [7:0] data,
    output parity
);

// Your code here

endmodule""",
        "testbench_template": """module testbench;
    reg [7:0] data;
    wire parity;
    
    parity_gen uut(.data(data), .parity(parity));
    
    initial begin
        $dumpfile("waveform.vcd");
        $dumpvars(0, testbench);
        {{INPUT}}
        #10 $finish;
    end
endmodule"""
    },
    {
        "title": "4-bit Ripple Carry Adder",
        "difficulty": "Easy",
        "tags": ["Combinational", "Adder", "Arithmetic"],
        "description": """Design a 4-bit ripple carry adder using full adders.

Cascade 4 full adders to create 4-bit addition.
Inputs: a[3:0], b[3:0], cin
Outputs: sum[3:0], cout

Module: ripple_carry_adder_4bit""",
        "constraints": "Use structural modeling with full adder instances",
        "starter_code": """module full_adder(
    input a, b, cin,
    output sum, cout
);
    assign sum = a ^ b ^ cin;
    assign cout = (a & b) | (b & cin) | (cin & a);
endmodule

module ripple_carry_adder_4bit(
    input [3:0] a, b,
    input cin,
    output [3:0] sum,
    output cout
);

// Your code here

endmodule""",
        "testbench_template": """module testbench;
    reg [3:0] a, b;
    reg cin;
    wire [3:0] sum;
    wire cout;
    
    ripple_carry_adder_4bit uut(.a(a), .b(b), .cin(cin), .sum(sum), .cout(cout));
    
    initial begin
        $dumpfile("waveform.vcd");
        $dumpvars(0, testbench);
        {{INPUT}}
        #10 $finish;
    end
endmodule"""
    },
]

print(f"\n📝 Adding {len(PROBLEMS_DATA)} problems...")

for idx, problem in enumerate(PROBLEMS_DATA, 1):
    try:
        response = requests.post(
            f"{API_URL}/problems",
            json=problem,
            cookies=cookies
        )
        
        if response.status_code == 200:
            print(f"✅ {idx}. {problem['title']} ({problem['difficulty']})")
        else:
            print(f"❌ {idx}. {problem['title']} - Error: {response.status_code}")
            print(f"   Response: {response.text[:100]}")
    except Exception as e:
        print(f"❌ {idx}. {problem['title']} - Exception: {str(e)}")

print(f"\n🎉 Batch complete! Check admin panel for results.")
print(f"📊 Total problems should be: {7 + len(PROBLEMS_DATA)}")
