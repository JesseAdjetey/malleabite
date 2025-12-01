
=============================================
Malleabite: Modular Productivity & AI Scheduling platform
==================================================

Malleabite is a flexible, modular time-management and productivity web app. It helps you organize tasks, manage your calendar, set reminders, and boost productivity using proven techniques—all in a customizable, real-time environment powered by AI.

----------------------
Key Features
----------------------
- Modular sidebar: Add/remove productivity modules (To-Do, Eisenhower Matrix, Pomodoro, Reminders, Invites, and more)
- AI-powered scheduling: Use natural language to create, edit, or delete events with Mally AI (Anthropic Claude integration)
- Real-time updates: See changes instantly across devices
- Calendar & event management: Schedule, edit, and delete events
- Eisenhower Matrix: Prioritize tasks by urgency and importance
- Pomodoro timer: Track focused work sessions
- Reminders & alarms: Never miss important tasks
- Collaborative invites: Share events and manage RSVPs
- Data visualization: View productivity stats and charts

----------------------
Tech Stack
----------------------
Frontend:
- React (with TypeScript)
- Vite (fast dev/build tool)
- shadcn-ui (UI components)
- Tailwind CSS (utility-first styling)
- Framer Motion (animations)
- Lucide-react (icons)
- Zustand (state management)
- @tanstack/react-query (data fetching/caching)

Backend:
- **Supabase** (Postgres database, Auth, Realtime, Edge Functions) - *Currently active*
- **Firebase** (Firestore, Auth, Cloud Functions) - *Migration 75% complete*
- Feature flags allow gradual migration between backends
- Firebase Cloud Functions for AI scheduling and transcription
- Anthropic Claude (AI for natural language scheduling)

Other:
- date-fns / dayjs (date/time utilities)
- recharts (charts/graphs)
- sonner (toast notifications)
- clsx, tailwind-merge (class utilities)
- ESLint, PostCSS (dev tooling)

----------------------
Getting Started
----------------------
1. **Clone the repository:**
   git clone <YOUR_GIT_URL>
   cd malleabite

2. **Install dependencies:**
   npm install

3. **Start the development server:**
   npm run dev

4. **Open your browser:**
   Visit http://localhost:5173 (or the port shown in your terminal)


----------------------
How It Works
----------------------
- The frontend (React) provides a modular, interactive UI.
- All data (tasks, events, users) is stored in Supabase (Postgres).
- Supabase Edge Functions handle backend logic, including AI scheduling.
- Mally AI (Anthropic Claude) lets you create, edit, or delete events by typing natural language requests.
- Real-time updates keep your data in sync across devices.

----------------------
AI Assistant (Mally AI)
----------------------
- Mally AI is an intelligent calendar assistant.
- You can schedule, reschedule, or cancel events using plain English.
- Mally AI responds conversationally and always includes a structured JSON block for database operations.
- See `docs/ENHANCED_MALLY_SYSTEM_PROMPT.md` for the exact system prompt and JSON format.

----------------------
Project Structure
----------------------
- /src/components: UI modules and shared components
- /src/hooks: Custom hooks for data and logic
- /src/lib: Utilities and global stores
- /supabase/functions: Serverless backend functions
- /docs: Documentation and system prompts

----------------------
Contributing
----------------------
1. Fork the repo and create a feature branch
2. Make your changes and commit
3. Open a pull request

----------------------
Roadmap & Development
----------------------
**Current Status:** Production-Ready Core (v1.0) ✅

**Next Phase:** Intelligence Enhancement (Phase 1) - 3-6 months

📋 **Quick Links:**
- [**START HERE**](docs/START_HERE.md) - Your immediate next steps
- [Executive Summary](docs/ROADMAP_EXECUTIVE_SUMMARY.md) - High-level overview
- [Full Roadmap](docs/ROADMAP_IMPLEMENTATION_PLAN.md) - Complete 18-month plan
- [Phase 1 Guide](docs/PHASE_1_QUICK_START.md) - Current phase breakdown
- [Vision Document](docs/MALLEABITE_VISION_COMPLETE.md) - App philosophy & goals

**Phase 1 Focus:**
- 🔍 Smart conflict detection
- 📊 Productivity analytics dashboard
- 🧠 Time block optimization
- 🤖 Machine learning foundation

See [docs/START_HERE.md](docs/START_HERE.md) for immediate action plan.

----------------------
Support & Documentation
----------------------
- For issues, open a GitHub issue or check the /docs folder for troubleshooting and advanced usage.
- See ENHANCED_MALLY_SYSTEM_PROMPT.md for details on AI scheduling integration.
- For roadmap and development, see the Roadmap & Development section above.

----------------------
License
----------------------
This project is licensed under the MIT License.

----------------------
Contact
----------------------
For questions or feedback, please open an issue or contact the maintainer.
Jesse Adjetey
jesseniiadjetey@gmail.com

Enjoy using Malleabite!
