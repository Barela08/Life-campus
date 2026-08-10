# 🎓 LIFE CAMPUS

> ## 🤖 AI Face Recognition Attendance & Campus Management System

<div align="center">

**Smart • Secure • Automated • Real-Time**

Face Recognition + Attendance + Admin + Teacher + Student Portal

</div>

---

## 🚀 QUICK START

### 📍 Project Location

```text
C:\Users\hp\Downloads\Life campus
```

### ▶️ Start Backend

```powershell
cd "C:\Users\hp\Downloads\Life campus\backend"

.\venv\Scripts\Activate.ps1

uvicorn app.main:app --reload
```

### ▶️ Start Frontend

Open a **second terminal**:

```powershell
cd "C:\Users\hp\Downloads\Life campus\frontend"

npm run dev
```

### 🌐 Open Application

```text
http://localhost:5173/
```

---

# 🔐 DEVELOPMENT LOGIN

> ⚠️ These credentials are for **local development/testing only**.
> Change them before production deployment.

## 👑 ADMIN

```text
┌─────────────────────────────────┐
│         ADMIN LOGIN             │
├─────────────────────────────────┤
│ Username : admin                │
│ Password : 1234                 │
│ URL      : /admin               │
└─────────────────────────────────┘
```

Open:

```text
http://localhost:5173/admin
```

---

## 👨‍🏫 TEACHER

```text
┌─────────────────────────────────┐
│        TEACHER LOGIN            │
├─────────────────────────────────┤
│ Username : TCH001               │
│ Password : 1234                 │
│ URL      : /teacher             │
└─────────────────────────────────┘
```

Open:

```text
http://localhost:5173/teacher
```

### ✅ Verified Development Credential

```text
TCH001 / 1234
```

This credential was verified against the local development API.

---

## 👨‍🎓 STUDENT

Student accounts should be created/managed through the Admin Panel.

```text
┌─────────────────────────────────┐
│        STUDENT LOGIN            │
├─────────────────────────────────┤
│ Username : Created by Admin     │
│ Password : Set by Admin/User    │
│ URL      : /student             │
└─────────────────────────────────┘
```

Open:

```text
http://localhost:5173/student
```

---

# 🏠 APPLICATION MODULES

```text
                    LIFE CAMPUS
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ATTENDANCE         ADMIN          TEACHER
        │               │               │
        │               │               │
        ▼               ▼               ▼
   Face Scan        Management      Classes
   Recognition      Students        Attendance
   Attendance       Teachers        Reports
                    Departments
                    Classes
                    Reports
                        │
                        ▼
                    STUDENT
                        │
                        ▼
                   Attendance
                   Percentage
                   History
                   Reports
```

---

# 🌐 URLS

| Module | URL |
|---|---|
| 🟢 Attendance | `http://localhost:5173/` |
| 👑 Admin | `http://localhost:5173/admin` |
| 👨‍🏫 Teacher | `http://localhost:5173/teacher` |
| 👨‍🎓 Student | `http://localhost:5173/student` |
| ⚙️ Backend | `http://127.0.0.1:8000` |
| 📚 API Docs | `http://127.0.0.1:8000/docs` |
| 📖 ReDoc | `http://127.0.0.1:8000/redoc` |

---

# 🎥 ATTENDANCE SYSTEM

The Attendance Terminal is the default home screen.

```text
Open Application
       ↓
Attendance Terminal
       ↓
Teacher Login
       ↓
Select Department
       ↓
Select Class
       ↓
Select Section
       ↓
Start Camera
       ↓
Face Detection
       ↓
Liveness / Anti-Spoof
       ↓
Face Recognition
       ↓
Student Verification
       ↓
Class Verification
       ↓
Duplicate Check
       ↓
Attendance Marked
       ↓
Email Sent
       ↓
Dashboards Updated
```

---

# 🧑‍💻 FACE REGISTRATION

Admin registers student faces.

Supported angles:

```text
┌──────────────────────────────┐
│     FACE REGISTRATION        │
├──────────────────────────────┤
│ ✓ Front                      │
│ ✓ Left                       │
│ ✓ Right                      │
│ ✓ Up                         │
│ ✓ Down                       │
│ ✓ Smile                      │
│ ✓ Normal                     │
└──────────────────────────────┘
```

The system creates face embeddings and associates them with the correct student.

---

# 🧠 FACE RECOGNITION

The system follows:

```text
Camera Frame
     ↓
Face Detection
     ↓
Image Quality Check
     ↓
Liveness Check
     ↓
Face Embedding
     ↓
Compare With Registered Faces
     ↓
Confidence / Distance Threshold
     ↓
Student Identification
     ↓
Department/Class Verification
     ↓
Duplicate Check
     ↓
Attendance
```

### ❌ Unknown Face

Unknown faces are **not marked present**.

### ❌ Wrong Class

If the face belongs to a student from another class/section:

```text
Student belongs to another class/section.
```

Attendance is not marked.

### ❌ Duplicate

If attendance already exists for the same session:

```text
Attendance Already Marked
```

No duplicate record is created.

---

# 📧 EMAIL NOTIFICATIONS

After successful attendance:

```text
Face Match
     ↓
Attendance Saved
     ↓
Email Service
     ↓
Student Email
```

Email can contain:

```text
Student Name
Roll Number
Department
Course
Semester
Class
Section
Subject
Teacher
Date
Time
Attendance Status
Attendance Percentage
```

---

# 🛠️ TECHNOLOGY STACK

## Backend

```text
Python
FastAPI
JWT Authentication
SQL Database
Face Recognition
OpenCV / Camera Processing
SMTP Email
OpenPyXL
Python Multipart
Bcrypt / Password Hashing
```

## Frontend

```text
React
TypeScript
Vite
React Router
TailwindCSS
Axios
Recharts
Lucide React
React Dropzone
```

---

# 📁 PROJECT STRUCTURE

```text
Life Campus/
│
├── 📂 backend/
│   ├── 📂 app/
│   │   ├── 📂 api/
│   │   ├── 📂 core/
│   │   ├── 📂 models/
│   │   ├── 📂 schemas/
│   │   ├── 📂 services/
│   │   └── main.py
│   │
│   ├── requirements.txt
│   ├── .env
│   └── ...
│
├── 📂 frontend/
│   ├── 📂 src/
│   │   ├── 📂 components/
│   │   ├── 📂 pages/
│   │   ├── 📂 services/
│   │   ├── 📂 store/
│   │   └── ...
│   │
│   ├── package.json
│   └── ...
│
├── 📂 database/
├── 📂 uploads/
├── 📂 embeddings/
├── 📂 reports/
├── 📂 logs/
│
└── 📄 README.md
```

---

# 💻 REQUIREMENTS

Install:

```text
┌──────────────────────────────┐
│ REQUIREMENTS                 │
├──────────────────────────────┤
│ Python 3.11 recommended      │
│ Node.js 20+                  │
│ npm                          │
│ Git                          │
│ VS Code                      │
│ Webcam                       │
└──────────────────────────────┘
```

Check versions:

```powershell
python --version
node --version
npm --version
git --version
```

---

# 📦 BACKEND INSTALLATION

```powershell
cd "C:\Users\hp\Downloads\Life campus\backend"
```

Create environment:

```powershell
python -m venv venv
```

Activate:

```powershell
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

# 📦 FRONTEND INSTALLATION

```powershell
cd "C:\Users\hp\Downloads\Life campus\frontend"
```

Install:

```powershell
npm install
```

---

# ▶️ RUN BACKEND

```powershell
cd "C:\Users\hp\Downloads\Life campus\backend"

.\venv\Scripts\Activate.ps1

uvicorn app.main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

---

# ▶️ RUN FRONTEND

Open another terminal:

```powershell
cd "C:\Users\hp\Downloads\Life campus\frontend"

npm run dev
```

Frontend:

```text
http://localhost:5173/
```

---

# 📷 CAMERA SETUP

The browser needs permission to access the webcam.

When prompted:

```text
Allow camera access?
```

Select:

```text
Allow
```

If camera doesn't work:

```text
Browser Settings
      ↓
Site Settings
      ↓
Camera
      ↓
Allow
```

Close other applications that may be using the camera:

```text
Zoom
Teams
Google Meet
Camera App
Other browser tabs
```

Then use:

```text
Refresh Camera
```

or:

```text
Switch Camera
```

---

# 📧 EMAIL CONFIGURATION

Create:

```text
backend/.env
```

Example:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-google-app-password

SMTP_FROM_EMAIL=your-email@gmail.com

SMTP_USE_TLS=true
```

⚠️ Never put the real password in this README.

Never commit:

```text
.env
```

to GitHub.

---

# 🔐 SECURITY

Never expose:

```text
JWT Secret
SMTP Password
Database Password
API Keys
Private Keys
```

Use environment variables.

The project should use:

```text
JWT
Password Hashing
RBAC
Input Validation
Rate Limiting
Secure Uploads
Audit Logs
Session Management
```

---

# 🗄️ DATABASE

Database is the central source of truth.

It stores:

```text
Students
Teachers
Departments
Courses
Semesters
Classes
Sections
Subjects
Face Embeddings
Attendance Sessions
Attendance Records
Notifications
Audit Logs
User Profiles
System Settings
```

---

# 📊 REPORTS

The system can provide:

```text
Attendance Reports
Student Reports
Teacher Reports
Class Reports
Department Reports
Monthly Reports
Subject Reports
Attendance Percentage
Analytics
```

Supported exports where implemented:

```text
PDF
Excel
CSV
```

---

# 🔄 REAL-TIME FLOW

```text
Face Match
    ↓
Attendance Database
    ↓
 ┌──┼─────────────┐
 ↓  ↓             ↓
Admin Teacher   Student
 ↓    ↓            ↓
Dashboard        Dashboard
    ↓
Reports
    ↓
Email
```

No manual refresh should be required for supported real-time updates.

---

# 🧪 TESTING CHECKLIST

```text
[ ] Backend starts
[ ] Frontend starts
[ ] Database connects
[ ] Admin login works
[ ] Teacher login works
[ ] Student login works
[ ] Attendance screen opens
[ ] Camera permission works
[ ] Camera preview works
[ ] Face registration works
[ ] All face angles work
[ ] Embeddings save correctly
[ ] Face recognition works
[ ] Unknown face rejected
[ ] Wrong class rejected
[ ] Duplicate attendance prevented
[ ] Attendance saved
[ ] Email sent
[ ] Admin sees attendance
[ ] Teacher sees attendance
[ ] Student sees attendance
[ ] Reports work
[ ] Export works
[ ] No TypeScript errors
[ ] No Python errors
[ ] No runtime errors
```

---

# 🔧 TROUBLESHOOTING

## Backend won't start

Check:

```powershell
python --version
```

Activate environment:

```powershell
.\venv\Scripts\Activate.ps1
```

Install:

```powershell
pip install -r requirements.txt
```

Then:

```powershell
uvicorn app.main:app --reload
```

---

## Frontend won't start

Run:

```powershell
npm install
npm run dev
```

For build testing:

```powershell
npm run build
```

---

## Camera is black

Check:

```text
✓ Camera permission
✓ Webcam connected
✓ Browser permission
✓ Camera not being used by another application
✓ Correct camera selected
✓ Backend is running
```

---

## Face isn't recognized

Check:

```text
✓ Student registered
✓ Face embeddings exist
✓ Face is clearly visible
✓ Lighting is sufficient
✓ Student belongs to selected class
✓ Backend recognition service is running
```

---

# 🚚 MOVE TO ANOTHER COMPUTER

Install:

```text
Python
Node.js
Git
VS Code
```

Copy the project.

Then:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Then:

```powershell
cd ..\frontend
npm install
```

Create the `.env` file again.

Then run backend and frontend normally.

---

# ⚠️ IMPORTANT ABOUT DATA

If SQLite/local storage is being used, moving only the source code may NOT move the existing data.

Backup:

```text
Database
Face Embeddings
Student Data
Uploaded Files
Reports
Configuration
```

before moving the project.

---

# 🔒 PRODUCTION WARNING

The following credentials are development credentials only:

```text
Admin:
admin / 1234

Teacher:
TCH001 / 1234
```

Before deploying publicly:

```text
✓ Change Admin Password
✓ Change Teacher Password
✓ Remove default accounts
✓ Generate a strong JWT secret
✓ Configure production database
✓ Configure HTTPS
✓ Secure SMTP credentials
✓ Disable debug mode
✓ Configure CORS properly
✓ Enable rate limiting
✓ Review RBAC
✓ Review audit logs
```

---

# ⚡ QUICK COMMAND REFERENCE

## Backend

```powershell
cd "C:\Users\hp\Downloads\Life campus\backend"
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

## Frontend

```powershell
cd "C:\Users\hp\Downloads\Life campus\frontend"
npm run dev
```

## Frontend Build

```powershell
cd "C:\Users\hp\Downloads\Life campus\frontend"
npm run build
```

---

# 🏁 START HERE

After installation:

```text
1. Start Backend
        ↓
2. Start Frontend
        ↓
3. Open http://localhost:5173/
        ↓
4. Teacher Login
        ↓
5. Start Attendance
        ↓
6. Camera
        ↓
7. Face Recognition
        ↓
8. Attendance
        ↓
9. Email
```

---

# 🎓 LIFE CAMPUS

```text
┌──────────────────────────────────────────────┐
│                                              │
│              🎓 LIFE CAMPUS                  │
│                                              │
│       AI FACE RECOGNITION ATTENDANCE         │
│                                              │
│       Admin • Teacher • Student              │
│                                              │
│       Smart • Secure • Automated             │
│                                              │
└──────────────────────────────────────────────┘
```

**Development Documentation — Life Campus**
