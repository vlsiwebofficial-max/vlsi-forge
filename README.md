# VLSI Forge - The LeetCode for RTL Design

A comprehensive web platform for practicing Verilog/RTL design with instant simulation, waveform analysis, and automated evaluation.

## 🚀 Features

### Core Functionality
- **Monaco Code Editor**: Professional VSCode-like editor with Verilog syntax highlighting
- **Instant Simulation**: Powered by Icarus Verilog for fast and reliable compilation
- **Waveform Analysis**: Generate and download VCD files for signal analysis
- **Auto Judge**: Automated testcase evaluation with detailed feedback
- **Testbench Support**: Write custom testbenches to verify your RTL designs

### User Features
- **Dual Authentication**: JWT-based email/password + Google OAuth integration
- **Problem Library**: 50+ problems across Easy, Medium, and Hard difficulties
- **Practice Topics**: FSM, FIFO, UART, AXI, CDC, Arbiters, Counters, and more
- **User Dashboard**: Track progress, view stats, and monitor submission history
- **Difficulty Tracking**: Separate stats for Easy, Medium, and Hard problems
- **Submission History**: Detailed table with results, test cases, and timestamps

### Admin Features
- **Problem Management**: Create, edit, and delete problems
- **Testcase Management**: Add hidden and visible testcases
- **User Management**: View all users and their activity
- **Submission Analytics**: Monitor platform-wide submissions

## 🎨 Design

### Color Scheme
- **Primary**: Cyan Blue (#0099FF) - Modern tech feel
- **Accent**: Purple (#A855F7) - Semiconductor vibes  
- **Background**: Deep Dark (#050A0F - #0A1628) - Professional look
- **Theme**: Dark mode first with chip patterns and glowing effects

### Typography
- **Headings**: Space Grotesk (Bold, Technical)
- **Body**: Inter (Clean, Readable)
- **Code**: JetBrains Mono (Monospace)

## 🛠️ Tech Stack

### Frontend
- React 19
- React Router v7
- @monaco-editor/react (Code Editor)
- Shadcn UI (Component Library)
- Tailwind CSS (Styling)
- Recharts (Data Visualization)
- Sonner (Toast Notifications)

### Backend
- FastAPI (Python Web Framework)
- Motor (Async MongoDB Driver)
- Icarus Verilog (Verilog Compiler & Simulator)
- BCrypt (Password Hashing)
- HTTPX (Async HTTP Client)
- JWT (Session Management)

### Database
- MongoDB (Document Store)

### Authentication
- Emergent Auth (Google OAuth)
- JWT-based sessions
- BCrypt password hashing

## 📋 Prerequisites

- Python 3.11+
- Node.js 20+
- MongoDB
- Icarus Verilog
- Yarn package manager

## 🚀 Getting Started

### 1. Install Dependencies

#### Backend
```bash
cd /app/backend
pip install -r requirements.txt
```

#### Frontend
```bash
cd /app/frontend
yarn install
```

#### Install Icarus Verilog
```bash
sudo apt-get update
sudo apt-get install -y iverilog
```

### 2. Environment Configuration

#### Backend (.env)
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
JWT_SECRET="your-secret-key-change-in-production"
```

#### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://your-app.preview.emergentagent.com
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

### 3. Seed Database

```bash
python3 /app/scripts/seed_database.py
```

This creates:
- Admin user: `admin@vlsiweb.com` / `admin123`
- 3 sample problems (Half Adder, 2-to-1 MUX, D Flip-Flop)

### 4. Start Services

```bash
sudo supervisorctl restart backend frontend
```

## 🎯 Usage

### For Students
1. **Register/Login**: Create account or use Google OAuth
2. **Browse Problems**: Filter by difficulty (Easy/Medium/Hard) or tags
3. **Solve Problems**: Write Verilog code in Monaco editor
4. **Run Simulation**: Click "Run Simulation" to compile and test
5. **View Results**: See test case results and download VCD files
6. **Track Progress**: Monitor stats on dashboard

### For Admins
1. **Login**: Use admin credentials
2. **Access Admin Panel**: Click Admin in navigation
3. **Create Problems**: Add title, description, constraints, starter code
4. **Add Testcases**: Define input data and expected outputs
5. **Manage Users**: View all registered users

## 🔧 Key Improvements Implemented

### Authentication
✅ Email/password validation with error messages
✅ Form validation for all input fields
✅ Close button on login/register modals
✅ Proper error handling and user feedback

### Dashboard
✅ Primary action buttons (Solve First Problem / Resume Last)
✅ New user onboarding message
✅ Clickable difficulty cards (redirect to filtered problems)
✅ Recent submissions table with detailed info
✅ Empty state handling with helpful messages
✅ Progress bar with percentage
✅ Streak tracking placeholder
✅ Platform stats (total problems, difficulty breakdown)
✅ Color-coded accuracy indicators
✅ Submission stats (passed/failed/errors)

### Landing Page
✅ VLSI Forge branding
✅ "How It Works" section (4-step process)
✅ Practice Topics section (9+ categories)
✅ "Who Is This For?" section (Students/Engineers/Companies)
✅ Trust signals (Powered by Icarus Verilog, Secure, No Installation)
✅ Platform scale indicators
✅ Strong CTAs with clear action items
✅ Modern semiconductor color scheme

### Problem Editor
✅ Testbench tab for custom testbench code
✅ Design and Testbench editor tabs
✅ Simulation log output tab
✅ Error highlighting in separate tab
✅ VCD download button
✅ Real-time compilation and simulation
✅ Detailed test case results

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google/session` - Google OAuth session exchange
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### Problems
- `GET /api/problems` - Get all problems (with filters)
- `GET /api/problems/{id}` - Get problem by ID
- `POST /api/problems` - Create problem (Admin)
- `PUT /api/problems/{id}` - Update problem (Admin)
- `DELETE /api/problems/{id}` - Delete problem (Admin)

### Submissions
- `POST /api/submissions` - Submit code for evaluation
- `GET /api/submissions/{id}` - Get submission details
- `GET /api/submissions/{id}/vcd` - Download VCD file
- `GET /api/submissions/user/me` - Get user's submissions

### Stats
- `GET /api/stats/me` - Get current user's statistics

### Admin
- `GET /api/admin/users` - Get all users (Admin)
- `GET /api/admin/submissions` - Get all submissions (Admin)
- `POST /api/testcases` - Add testcase to problem (Admin)
- `DELETE /api/testcases/{problem_id}/{testcase_id}` - Delete testcase (Admin)

## 🔐 Security

- HttpOnly cookies for session tokens
- Secure flag for production cookies
- SameSite=None for cross-origin requests
- BCrypt password hashing with salt
- JWT token expiration (7 days)
- CORS configuration
- MongoDB injection prevention (Pydantic validation)
- Custom user_id (avoiding MongoDB ObjectId issues)

## 🎓 Sample Problems

### 1. Half Adder (Easy)
Design a half adder with two inputs (a, b) and two outputs (sum, carry).

### 2. 2-to-1 Multiplexer (Easy)
Implement a 2-to-1 multiplexer with inputs (a, b, sel) and output (out).

### 3. D Flip-Flop (Medium)
Create a positive edge-triggered D flip-flop with reset functionality.

## 🐛 Known Issues & Future Enhancements

### Phase 2 Enhancements
- [ ] Docker-based secure sandbox execution
- [ ] Interactive waveform viewer (browser-based)
- [ ] Synthesis reports (area, timing, power)
- [ ] Timed contests
- [ ] Leaderboard
- [ ] Discussion forum
- [ ] AI hint system
- [ ] Company-specific problem sets
- [ ] SystemVerilog/UVM support

## 📝 License

Copyright © 2026 VLSI Forge. All rights reserved.

## 🙏 Credits

- **Powered by**: Icarus Verilog (open-source Verilog compiler)
- **UI Components**: Shadcn UI
- **Code Editor**: Monaco Editor (VSCode)
- **Icons**: Lucide React
- **Charts**: Recharts
