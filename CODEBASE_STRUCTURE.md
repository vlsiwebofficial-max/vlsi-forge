# VLSI Forge - Complete Codebase Structure

## Directory Structure
```
/app/
├── backend/
│   ├── server.py              # Main FastAPI application
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Environment variables
│
├── frontend/
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── index.js          # React entry point
│   │   ├── App.js            # Main app component with routing
│   │   ├── App.css           # App styles
│   │   ├── index.css         # Global styles with theme
│   │   ├── components/
│   │   │   ├── ui/           # Shadcn UI components
│   │   │   └── AuthCallback.js
│   │   ├── pages/
│   │   │   ├── LandingPage.js
│   │   │   ├── LoginPage.js
│   │   │   ├── RegisterPage.js
│   │   │   ├── DashboardPage.js
│   │   │   ├── ProblemsPage.js
│   │   │   ├── ProblemDetailPage.js
│   │   │   ├── SubmissionPage.js
│   │   │   └── AdminPage.js
│   │   └── hooks/
│   │       └── use-toast.js
│   ├── package.json           # Node dependencies
│   ├── tailwind.config.js     # Tailwind configuration
│   └── .env                   # Frontend environment variables
│
├── scripts/
│   ├── seed_database.py       # Initial database seeding
│   ├── add_50_problems.py     # Add more problems
│   └── update_problems_with_comments.py
│
├── README.md                  # Project documentation
└── HOW_TO_ADD_PROBLEMS.md    # Problem creation guide
```

## Tech Stack

**Backend:**
- FastAPI (Python web framework)
- Motor (Async MongoDB driver)
- Icarus Verilog (Verilog compiler/simulator)
- BCrypt (Password hashing)
- JWT (Authentication)
- HTTPX (HTTP client)

**Frontend:**
- React 19
- React Router v7
- Monaco Editor (VSCode editor)
- Shadcn UI (Component library)
- Tailwind CSS
- Recharts (Data visualization)
- Sonner (Toast notifications)

**Database:**
- MongoDB

**Authentication:**
- JWT + BCrypt
- Google OAuth (Emergent Auth)
