🥗 AI Monitoring Nutrition Assistant
-> Track your nutrition. Understand your habits. Get smarter guidance. 🤖🥗**

AI Monitoring Nutrition Assistant is a full-stack web application designed to help users monitor their **meals, nutrition, exercise, weight and dietary goals** with the support of AI-powered insights.

✨ What Can It Do?

- 👤 User registration & login
- 🍽️ Track meals and nutrition
- 🏋️ Monitor exercise and activity
- ⚖️ Track weight and progress
- 🤖 Get AI-powered nutrition guidance
- 🥗 AI-assisted food analysis
- 📊 Monitor dietary habits and progress

🧠 How It Works

👤 User
   ↓
⚛️ React Frontend
   ↓
🚀 FastAPI Backend
   ↓
🍃 MongoDB
   ↓
🤖 OpenRouter → Gemini AI
   ↓
💡 Personalized Insights

🛠️ Tech Stack

Frontend
-React.js
-Vite
-Axios

Backend
-Python
-FastAPI
-Uvicorn
-Pydantic

Database
-MongoDB
-Motor

AI
-OpenRouter API
-Google Gemini 2.5 Flash

Security
-JWT Authentication
-bcrypt Password Hashing

📁 Project Structure
Ai-monitoring-nutrition-assistant/
│
├── client/       # React Frontend
├── server/       # FastAPI Backend
└── .gitignore

🚀 Run Locally

1️⃣ Clone the project
git clone https://github.com/ajaykrish716/Ai-monitoring-nutrition-assistant.git
cd Ai-monitoring-nutrition-assistant

2️⃣ Backend Setup
cd server
python -m venv venv

Activate the virtual environment:

Windows PowerShell: 
.\venv\Scripts\Activate.ps1

Install dependencies:
pip install -r requirements.txt

Create .env from .env.example and add your required configuration, including your OpenRouter API key.

Start the backend:
uvicorn app.main:app --reload

Backend:
http://127.0.0.1:8000

API Documentation:
http://127.0.0.1:8000/docs

3️⃣ Frontend Setup
Open a new terminal:
cd client
npm install

Create .env from .env.example.

Then start the frontend:
npm run dev

Open:
http://localhost:5173
