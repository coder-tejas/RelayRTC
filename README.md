# 🎥🌐 WebRTC Video Conferencing App 🚀✨
💬📹 A Beginner-Friendly, Full-Stack Video Calling Application 📹💬

This project is a modern video conferencing application built using WebRTC 🔥 with an SFU (Selective Forwarding Unit) architecture 🧠⚙️. It allows multiple users to join video meetings 👥, communicate in real-time 🎤, share screens 🖥️, and manage meetings easily 🔗.

Perfect for students 🎓, beginners 🐣, interns 💼, interview demos 💯🔥, **and for anyone who wants to build a WebRTC app completely from scratch** 🛠️🚀.

---

## 🌟✨ Features (Explained Simply) ✨🌟

### 🔐👤 Authentication & User Management
- 🔑 JWT Authentication – secure token-based login  
- 📝 Register & Login – create account and sign in  
- 🚧 Protected Routes – auto redirect if user is not logged in  

### 📹🎙️ Video Conferencing
- 🧠 SFU-based WebRTC server  
- 👥 Multi-party video calls  
- 🎥 Real-time audio & video  
- 🖥️ Screen sharing  
- 🎛️ Media controls – Mic 🎤 | Camera 📷 | Screen 🖥️ ON/OFF  

### 🧾📅 Meeting Management
- ➕ Create meetings with unique IDs  
- 🔗 Join meetings via link or code  
- 🕒 View past and active meetings  
- 👑 Host controls for managing meetings  

### ⚡🔄 Real-Time Features
- 🔌 Socket.io for real-time signaling  
- 🤝 WebRTC ICE & SDP negotiation  
- 📊 Live connection stats  
- 🚦 Connection quality indicators  

### 🎨🖥️ Modern UI / UX
- 🧱 ShadCN UI components  
- 📱 Fully responsive design  
- 🌙 Dark theme for video calls  
- 🔔 Toast notifications  

---

## 🧠 How the System Works (High-Level Flow)

1️⃣ User opens the application  
2️⃣ User registers or logs in  
3️⃣ JWT token is generated and stored  
4️⃣ User creates or joins a meeting  
5️⃣ Socket.io connection is established  
6️⃣ WebRTC signaling (Offer, Answer, ICE) happens via Socket.io  
7️⃣ Media streams are sent to the SFU server  
8️⃣ SFU forwards streams to all other participants  
9️⃣ UI updates in real-time as users join/leave  

👉 This section explains the **complete end-to-end flow** of the app.

---

## 📡 WebRTC Flow (Beginner-Friendly Explanation)

WebRTC may look scary 😅 but it’s actually simple:

- getUserMedia() → gets camera & microphone access  
- RTCPeerConnection → manages peer connections  
- SDP (Offer/Answer) → tells what media is being sent  
- ICE Candidates → find best network path between peers  
- Socket.io → used ONLY for signaling (not media)  
- Media streams NEVER pass through REST APIs  

---

## 🧱 What is SFU & Why It Is Used?

SFU (Selective Forwarding Unit) is a server that:
- Receives media streams from all users  
- Forwards them to other participants  
- Does NOT re-encode video  

Why SFU?
- 🚀 Better performance  
- 🧠 Lower CPU usage  
- 📈 Scales better than mesh  
- 🏆 Used by Zoom, Google Meet, etc.  

---

## 🔌 Socket Events Used

These are the main real-time events in the system:

- join-meeting  
- leave-meeting  
- offer  
- answer  
- ice-candidate  
- user-joined  
- user-left  

👉 Knowing these events makes debugging MUCH easier.

---

## 🛠️⚙️ Tech Stack

### 🖥️ Backend
- 🟢 Node.js + Express.js  
- 🔌 Socket.io  
- 🍃 MongoDB + Mongoose  
- 🔐 JWT Authentication  
- 🔑 bcryptjs  
- 🧾 TypeScript  

### 🌐 Frontend
- ⚛️ Next.js 15  
- 🎨 Tailwind CSS  
- 🧱 ShadCN UI  
- 🧠 Zustand  
- 🔌 Socket.io Client  
- 📋 React Hook Form  
- 🧪 Zod  

---

## 📋✅ Prerequisites
- 🟢 Node.js (v18+)  
- 🍃 MongoDB (v5+)  
- 📦 npm or yarn  

---

## 🚀⚡ Quick Start Guide

### 1️⃣ Clone Repository
git clone <repository-url>  
cd webrtc  

### 2️⃣ Backend Setup
cd backend  
npm install  
cp .env.example .env  

Edit .env file:
NODE_ENV=development  
PORT=3000  
MONGODB_URI=mongodb://localhost:27017/webrtc-app  
JWT_SECRET=your-super-secret-key  
ALLOWED_ORIGINS=http://localhost:3001  

### 3️⃣ Frontend Setup
cd ../frontend  
npm install  

### 4️⃣ Start MongoDB

Windows:
net start MongoDB  

Ubuntu:
sudo systemctl start mongod  

macOS:
brew services start mongodb-community  

### 5️⃣ Run the Application

Backend:
cd backend  
npm run dev  

Frontend:
cd frontend  
npm run dev  

---

## 📂 Important Files Explained

backend/services/SFUServer.ts → Core SFU and forwarding logic  
frontend/services/webRTCService.ts → WebRTC client handling  
frontend/state/globalState.ts → Global app state (Zustand)  

---

## 🧪 Common Errors & Fixes

❌ Camera or mic not working  
✔️ Check browser permissions  

❌ Black video screen  
✔️ Ensure getUserMedia() succeeds  

❌ Remote video not visible  
✔️ ICE candidates not exchanged  

❌ Socket not connecting  
✔️ Backend not running or CORS issue  

❌ Audio echo  
✔️ Mute self audio playback  

---

## 📱🎯 How to Use

1️⃣ Register or login  
2️⃣ Open dashboard  
3️⃣ Create or join a meeting  

During meeting:
- 🎤 Toggle microphone  
- 📷 Toggle camera  
- 🖥️ Share screen  
- 📊 View stats  
- 🚪 Leave meeting  

---

## 🏗️📂 Project Structure

Backend:
backend/
models/
routes/
middleware/
services/
index.ts  

Frontend:
frontend/
app/
components/
services/
state/
api/  

---

## 🔐🛡️ Security
- 🔑 JWT authentication  
- 🔒 Encrypted passwords  
- 🚫 CORS protection  
- 🧪 Input validation  
- 🌱 Environment variables  

---

## 📊📈 Monitoring
- ⏱️ Latency  
- 📡 Bandwidth usage  
- 🚦 Connection quality  
- 👥 Participants  
- ⏳ Meeting duration  

---

## 🚀🌍 Production Build
npm run build  
npm start  

---

## 🚀 Future Improvements
- 💬 In-meeting chat  
- 🎥 Meeting recording  
- ✋ Raise hand feature  
- 🔇 Host mute controls  
- 🌐 TURN server support  

---

## 🤝✨ Contributing
1️⃣ Fork repository  
2️⃣ Create feature branch  
3️⃣ Commit changes  
4️⃣ Push branch  
5️⃣ Open pull request  

---

## 📝📄 License
MIT License  

---

## 🙏💖 Acknowledgements
- 🎥 WebRTC  
- 🔌 Socket.io   
- 🎨 ShadCN UI  
- ⚛️ Next.js  
- 🍃 MongoDB  

---

## 🎉🎊 Happy Video Conferencing! 🎥🚀✨
🔥 Beginner-friendly | Scratch-buildable | Interview-ready | Full-stack 🔥
