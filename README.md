# Practical Money Organiser (PMO)

This is a web app that helps groups of friends split expenses fairly and track balances easily. Built with React and Firebase.

## 🔧 Getting Started 

Follow the steps below to set up and run the app on your local machine.

### 1. 📦 Install Node.js

Download and install Node.js (which includes npm) from the official site:

🔗 https://nodejs.org/

Recommended version: LTS (Long-Term Support)

To verify installation, run in terminal:

    node -v
    npm -v

### 2. 📁 Clone the Repository

If you haven’t already, clone the repo:

git clone https://github.com/lihengliong/practical-money-organiser.git
cd practical-money-organiser  # or whatever folder name you chose when cloning

### 3. 📦 Install Project Dependencies

Install all required packages using npm:

    npm install

                react ^19.1.0

                react-dom ^19.1.0

                react-router-dom ^7.6.1

                firebase ^11.7.3

                tailwindcss ^4.1.8

@tailwindcss/vite ^4.1.8

Plus various dev dependencies like vite, eslint, and @vitejs/plugin-react

### 4. 🚀 Start the App

Run the development server:

    npm run dev

This will open the app in your browser at http://localhost:5173.

### 5. 🌐 Firebase Configuration (already included)

The Firebase configuration is already included in the codebase at:

src/config/firebase.js

No additional environment variables are required to run the app locally.

🛠️ Useful Scripts

    npm run dev — Starts the development server

    npm run build — Builds the app for production

    npm run preview — Previews the built app

    npm run lint — Lints the code (if ESLint is set up)

## 📚 Tech Stack

React.js

Vite

Firebase

Tailwind CSS

JavaScript (ES6+)

## 🧠 Tips

Make sure ports like 5173 are not blocked.

If you encounter issues, try deleting node_modules and reinstall:

    rm -rf node_modules
    npm install

## 🙌 Contributors

Built with ❤️ by Team PMO.

