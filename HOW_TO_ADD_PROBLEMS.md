# How to Add All 50 Problems

## Quick Method (Using Admin Panel)

1. **Login as Admin**: admin@vlsiweb.com / admin123
2. **Go to Admin Panel**: Click "Admin" in navigation
3. **Create Problems Manually**: Click "Create Problem" button

## Bulk Import Method (Recommended)

I've prepared the structure for all 50 problems. Here's how to bulk import them:

### Step 1: Create the complete problems script

Edit `/app/scripts/add_50_problems.py` and add all 50 problems following this pattern:

```python
{
    "title": "Problem Title",
    "description": "Detailed description with examples",
    "difficulty": "Easy|Medium|Hard",  
    "tags": ["Tag1", "Tag2"],
    "constraints": "Design constraints",
    "starter_code": "module name(...);\n// Code\nendmodule",
    "testbench_template": "module testbench;\n// TB code\nendmodule",
    "testcases": [
        {
            "testcase_id": "tc1",
            "input_data": "a=1; b=0; #5; $display(\"%b\", out);",
            "expected_output": "1",
            "is_hidden": False
        }
    ]
}
```

### Step 2: Run the script

```bash
cd /app
python3 scripts/add_50_problems.py
```

## Problem Categories

### EASY (15 problems) ✅
1. 2:1 Multiplexer ✅ (Already added)
2. 4:1 Multiplexer
3. 1:4 Demultiplexer
4. 4-bit Priority Encoder
5. 8-bit Comparator
6. 8-bit Parity Generator & Checker
7. 4-bit Ripple Carry Adder
8. Parameterized N-bit Adder
9. D Flip-Flop (Sync Reset)
10. D Flip-Flop (Async Reset)
11. T Flip-Flop
12. 4-bit Up Counter
13. 4-bit Up/Down Counter
14. Clock Divider (Even Division)
15. Rising Edge Detector

### MEDIUM (20 problems)
16. Sequence Detector (1011 - Mealy)
17. Sequence Detector (Moore FSM)
18. Traffic Light Controller FSM
19. 8-bit Shift Register (All Modes)
20. Pulse Width Counter
21. Debouncer Circuit
22. Gray Code Counter
23. Binary to Gray Converter
24. Gray to Binary Converter
25. Synchronous FIFO (Single Clock)
26. FIFO with Full/Empty Flags
27. Parameterized FIFO
28. Round Robin Arbiter (2 masters)
29. 4-Request Priority Arbiter
30. UART Transmitter
31. UART Receiver
32. UART TX + RX Loopback
33. SPI Master (Basic)
34. I2C Master (Single Byte Write)
35. Simple APB Slave

### HARD (10 problems)
36. Asynchronous FIFO (Dual Clock)
37. FIFO with Almost Full / Almost Empty
38. AXI-Lite Slave (Read + Write)
39. AXI-Lite Register Bank
40. Multi-Clock Domain Synchronizer
41. 2-Flip-Flop Synchronizer
42. Pulse Synchronizer (CDC)
43. 4x4 Matrix Multiplier (RTL)
44. Pipelined Multiplier
45. Fixed-Point MAC Unit

### VERY HARD (5 problems)
46. Configurable Packetizer FSM
47. UART with Configurable Baud Generator
48. Image 3x3 Convolution Engine (Streaming)
49. Sobel Edge Detection RTL Block
50. Simple RISC-V ALU (Subset Implementation)

## Current Status

- ✅ Platform infrastructure complete
- ✅ Admin panel working  
- ✅ Problem creation flow tested
- ✅ 3 seed problems working
- ⏳ 47 more problems to add

## Template for Each Problem

Each problem needs:
1. **Title**: Clear, concise name
2. **Description**: Problem statement with examples
3. **Difficulty**: Easy/Medium/Hard/Very Hard
4. **Tags**: For categorization (FSM, FIFO, CDC, etc.)
5. **Constraints**: Design rules
6. **Starter Code**: Module skeleton
7. **Testbench Template**: With {{INPUT}} placeholder
8. **Testcases**: Mix of visible and hidden test cases

## Tips for Creating Problems

### Good Testbench Pattern
```verilog
module testbench;
    reg inputs;
    wire outputs;
    
    module_name uut(.inputs(inputs), .outputs(outputs));
    
    initial begin
        $dumpfile("waveform.vcd");
        $dumpvars(0, testbench);
        
        {{INPUT}}  // Dynamic input insertion
        
        #10 $finish;
    end
endmodule
```

### Good Testcase Pattern
```python
{
    "testcase_id": "tc_descriptive_name",
    "input_data": "a=1; b=0; #5; $display(\"%b\", result);",
    "expected_output": "1",
    "is_hidden": False  # True for hidden test cases
}
```

## Verification Steps

After adding problems:
1. Check problem appears in list
2. Click "Solve" button
3. Verify Monaco editor loads
4. Write solution
5. Click "Run Simulation"
6. Verify testcases execute
7. Check VCD download works

## Need Help?

- Use existing 3 problems as reference templates
- Check `/app/scripts/seed_database.py` for examples
- Admin credentials: admin@vlsiweb.com / admin123
