# VLSI Forge - Complete Codebase Export

## Quick Start

### Prerequisites
```bash
- Python 3.11+
- Node.js 20+
- MongoDB
- Icarus Verilog (iverilog)
- Yarn
```

### Installation

1. **Backend Setup**
```bash
cd backend
pip install -r requirements.txt
```

2. **Frontend Setup**
```bash
cd frontend
yarn install
```

3. **Environment Configuration**

Backend `.env`:
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"
JWT_SECRET="your-secret-key-change-in-production"
```

Frontend `.env`:
```
REACT_APP_BACKEND_URL=https://your-app.preview.emergentagent.com
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

4. **Install Icarus Verilog**
```bash
sudo apt-get update
sudo apt-get install -y iverilog
```

5. **Seed Database**
```bash
python3 scripts/seed_database.py
```

6. **Start Services**
```bash
# Backend
cd backend
uvicorn server:app --host 0.0.0.0 --port 8001

# Frontend (new terminal)
cd frontend
yarn start
```

7. **Access**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8001
- Admin: admin@vlsiweb.com / admin123

## File Listing

Run this to see all key files:
```bash
tree -L 3 /app -I 'node_modules|__pycache__|.git|build|dist'
```

## Key Files to Review

### Backend (Python/FastAPI)
- `/app/backend/server.py` - Main API server (800+ lines)
- `/app/backend/requirements.txt` - Python dependencies

### Frontend (React)
- `/app/frontend/src/App.js` - Router & auth
- `/app/frontend/src/index.css` - Theme & colors
- `/app/frontend/src/pages/*.js` - All page components
- `/app/frontend/package.json` - Node dependencies

### Database Scripts
- `/app/scripts/seed_database.py` - Initial data
- `/app/scripts/add_50_problems.py` - Add problems

### Documentation
- `/app/README.md` - Full documentation
- `/app/HOW_TO_ADD_PROBLEMS.md` - Problem creation guide

## Feature Checklist

✅ Authentication (JWT + Google OAuth)
✅ Problem Management (CRUD)
✅ Monaco Code Editor (Verilog)
✅ Icarus Verilog Simulation
✅ VCD Waveform Download
✅ Code Persistence (saves user code)
✅ User Dashboard with Stats
✅ Admin Panel
✅ Responsive Design
✅ Professional Color Scheme

## Database Schema

### Collections

1. **users**
```json
{
  "user_id": "user_xxx",
  "email": "user@example.com",
  "name": "Full Name",
  "password_hash": "bcrypt_hash",
  "role": "user|admin",
  "picture": "url",
  "created_at": "ISO datetime"
}
```

2. **problems**
```json
{
  "problem_id": "prob_xxx",
  "title": "Problem Title",
  "description": "Markdown text",
  "difficulty": "Easy|Medium|Hard",
  "tags": ["FSM", "FIFO"],
  "constraints": "Design rules",
  "starter_code": "Verilog code",
  "testbench_template": "Verilog testbench",
  "testcases": [
    {
      "testcase_id": "tc_xxx",
      "input_data": "Verilog code",
      "expected_output": "0 0",
      "is_hidden": false
    }
  ],
  "created_by": "user_id",
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

3. **submissions**
```json
{
  "submission_id": "sub_xxx",
  "user_id": "user_xxx",
  "problem_id": "prob_xxx",
  "code": "User's Verilog code",
  "testbench": "Custom testbench",
  "status": "passed|failed|error",
  "testcase_results": [
    {
      "testcase_id": "tc_xxx",
      "passed": true,
      "output": "0 0",
      "error": null
    }
  ],
  "passed_count": 4,
  "total_count": 4,
  "compilation_error": null,
  "vcd_file_path": "/tmp/xxx/waveform.vcd",
  "submitted_at": "ISO datetime"
}
```

4. **user_sessions**
```json
{
  "session_id": "sess_xxx",
  "user_id": "user_xxx",
  "session_token": "session_xxx",
  "expires_at": "ISO datetime",
  "created_at": "ISO datetime"
}
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `POST /api/auth/google/session` - Google OAuth
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Problems
- `GET /api/problems` - List problems (with filters)
- `GET /api/problems/{id}` - Get problem
- `POST /api/problems` - Create (admin)
- `PUT /api/problems/{id}` - Update (admin)
- `DELETE /api/problems/{id}` - Delete (admin)

### Submissions
- `POST /api/submissions` - Submit code
- `GET /api/submissions/{id}` - Get submission
- `GET /api/submissions/{id}/vcd` - Download VCD
- `GET /api/submissions/user/me` - User's submissions

### Stats & Admin
- `GET /api/stats/me` - User statistics
- `GET /api/admin/users` - All users (admin)
- `GET /api/admin/submissions` - All submissions (admin)
- `POST /api/testcases` - Add testcase (admin)
- `DELETE /api/testcases/{pid}/{tid}` - Delete testcase (admin)

## Color Palette

```css
/* Professional Blue Theme */
--background: #0A0E14 to #0F1419 (gradient)
--card: HSL(220, 13%, 13%) - charcoal
--text: HSL(210, 20%, 95%) - off-white
--primary: HSL(210, 40%, 56%) - muted blue
--accent: HSL(212, 50%, 45%) - subtle blue
--border: HSL(215, 16%, 22%) - subtle gray
--destructive: HSL(0, 63%, 50%) - red
```

## Fonts
- **Headings:** Space Grotesk (bold, technical)
- **Body:** Inter (clean, readable)
- **Code:** JetBrains Mono (monospace)

## Deployment Notes

### Production Checklist
- [ ] Change JWT_SECRET in backend/.env
- [ ] Update MONGO_URL for production MongoDB
- [ ] Configure CORS_ORIGINS properly
- [ ] Set up HTTPS/SSL
- [ ] Enable Docker sandbox for secure execution
- [ ] Configure CDN for static assets
- [ ] Set up monitoring (logs, metrics)
- [ ] Configure backup for MongoDB
- [ ] Set up rate limiting
- [ ] Enable error tracking (Sentry)

### Security
- HttpOnly cookies for sessions
- BCrypt password hashing
- JWT token expiration (7 days)
- CORS configuration
- Input validation (Pydantic)
- MongoDB injection prevention
- Resource limits on simulation (10s timeout)

## Performance
- Async MongoDB operations (Motor)
- Hot reload in development
- Monaco Editor lazy loading
- Optimized images
- Tailwind CSS purging
- Gzip compression

## Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Known Limitations (MVP)
- Simulations run directly (no Docker sandbox yet)
- VCD download only (no in-browser waveform viewer yet)
- No synthesis reports (Yosys integration pending)
- No timed contests
- No discussion forum
- No leaderboard

## Future Enhancements (Phase 2)
1. Docker sandbox for secure execution
2. Interactive waveform viewer (WaveDrom)
3. Synthesis reports (Yosys)
4. Timed contests
5. Leaderboard
6. Discussion forum
7. AI hints system
8. SystemVerilog/UVM support
9. Company-specific problem sets
10. Mobile app

## License
Copyright © 2026 VLSI Forge. All rights reserved.

## Support
For issues, contact: support@vlsiforge.com (update with actual email)

---
Generated: 2026-02-22
Version: 1.0.0 (MVP)
Platform: VLSI Forge - Professional RTL Design Practice Platform
