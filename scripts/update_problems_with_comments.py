#!/usr/bin/env python3
"""
Update existing problems with better commented starter code
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

# Updated starter codes with comments
UPDATED_PROBLEMS = {
    "Half Adder": """module half_adder(
    input a,      // First input bit
    input b,      // Second input bit
    output sum,   // Sum output (a XOR b)
    output carry  // Carry output (a AND b)
);

// TODO: Implement half adder logic
// Hint: sum = a XOR b, carry = a AND b

endmodule""",
    
    "2-to-1 Multiplexer": """module mux_2to1(
    input a,      // Input 0
    input b,      // Input 1
    input sel,    // Select line (0: select a, 1: select b)
    output out    // Output
);

// TODO: Implement 2:1 MUX using conditional operator
// Hint: out = sel ? b : a

endmodule""",
    
    "D Flip-Flop": """module d_ff(
    input clk,    // Clock signal
    input d,      // Data input
    input reset,  // Synchronous reset (active high)
    output reg q  // Output (registered)
);

// TODO: Implement positive edge-triggered D flip-flop
// Hint: Use always @(posedge clk) block
// When reset=1, q should be 0
// When reset=0, q should capture d on rising edge

endmodule""",

    "4:1 Multiplexer": """module mux_4to1(
    input i0, i1, i2, i3,  // Four input lines
    input [1:0] sel,       // 2-bit select line
    output reg out         // Output
);

// TODO: Implement 4:1 MUX using case statement
// sel=00 -> i0, sel=01 -> i1, sel=10 -> i2, sel=11 -> i3
// Use always @(*) for combinational logic

endmodule""",

    "1:4 Demultiplexer": """module demux_1to4(
    input in,           // Input signal
    input [1:0] sel,    // 2-bit select line
    output reg y0, y1, y2, y3  // Four output lines
);

// TODO: Implement 1:4 DEMUX
// Route 'in' to one of 4 outputs based on sel
// Selected output = in, others = 0
// Use case statement

endmodule""",

    "4-bit Priority Encoder": """module priority_encoder_4bit(
    input [3:0] i,    // 4-bit input
    output reg [1:0] y // 2-bit encoded output
);

// TODO: Implement priority encoder
// Priority: i[3] > i[2] > i[1] > i[0]
// If i[3]=1, output should be 2'b11
// If i[3]=0 and i[2]=1, output should be 2'b10, etc.
// Use if-else or casex statement

endmodule"""
}

async def update_problems():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("📝 Updating problems with helpful comments...")
    
    for title, new_starter_code in UPDATED_PROBLEMS.items():
        result = await db.problems.update_one(
            {"title": title},
            {"$set": {"starter_code": new_starter_code}}
        )
        
        if result.modified_count > 0:
            print(f"✅ Updated: {title}")
        else:
            print(f"ℹ️  No change or not found: {title}")
    
    client.close()
    print("\n🎉 Update complete!")

if __name__ == "__main__":
    asyncio.run(update_problems())
