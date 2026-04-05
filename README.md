# 💧 WaterWatch

A community water issue reporting web app built with HTML, CSS, and JavaScript.

## 🌐 Live Demo
Deploy with GitHub Pages — see instructions below.

---

## 📁 Project Structure

```
WaterWatch/
├── index.html   → All HTML screens (signup, login, home, report, map, admin)
├── style.css    → All styles
├── app.js       → All JavaScript logic (auth, routing, maps, reports)
└── README.md    → This file
```

---

## ✨ Features

- **User Auth** — Signup, Login, Logout (stored in Firebase)
- **Private Reports** — Users only see their own reports
- **Report Issues** — 8 water issue types with photo upload and GPS pin on map
- **Live Map** — View your reported issues on an interactive Leaflet map
- **Status Updates** — Admin marks Resolved → users see it instantly
- **Admin Panel** — View ALL reports from all users, update status, add notes

---

## 🚀 Deploy on GitHub Pages

1. Push this folder to a GitHub repository
2. Go to **Settings → Pages**
3. Set source to `main` branch, root folder `/`
4. Your site will be live at `https://<your-username>.github.io/<repo-name>/`

---

## 🔑 Admin Credentials

Change these in `app.js` (top of file):

```js
var ADMIN_USER = 'admin';
var ADMIN_PASS = 'water@2024';
```

---

## 🗄️ Firebase Setup

The Firebase database URL is already hardcoded in `app.js`:

```js
var FB_URL = 'https://water-issue-reporting-app-default-rtdb.firebaseio.com';
```

---

## 🛠️ Tech Stack

- HTML5 / CSS3 / Vanilla JavaScript
- [Leaflet.js](https://leafletjs.com/) for interactive maps
- [OpenStreetMap](https://www.openstreetmap.org/) tiles
- [Firebase Realtime Database](https://firebase.google.com/) for shared data
- Google Fonts (Plus Jakarta Sans, Outfit)
- localStorage for session persistence
