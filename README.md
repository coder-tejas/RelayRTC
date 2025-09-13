# RelayRTC — WebRTC Video Conferencing Platform (SFU Architecture)

RelayRTC is a full-stack, production-style video conferencing application built using **WebRTC with an SFU (Selective Forwarding Unit) architecture**. It supports multi-party video meetings, real-time signaling, authentication, and meeting management, designed to demonstrate how modern platforms like Zoom or Google Meet work internally.

This project is suitable for:

* Learning WebRTC and real-time systems
* System design and backend engineering portfolios
* Interview demonstrations
* Building SFU-based media pipelines from scratch

---

## Key Features

### Authentication & User Management

* JWT-based authentication
* Secure login and registration
* Protected routes and session handling

### Video Conferencing (WebRTC + SFU)

* SFU-based multi-party video calls
* Real-time audio and video streaming
* Screen sharing support
* Media controls (microphone, camera, screen toggle)

### Meeting Management

* Create and join meetings via unique IDs
* Host and participant roles
* Active and past meeting tracking

### Real-Time Signaling

* Socket.io for signaling
* SDP (Offer/Answer) exchange
* ICE candidate negotiation
* Live participant join/leave updates

### UI / UX

* Modern responsive interface
* Dark mode optimized for video calls
* Real-time notifications
* Connection quality indicators

---

## High-Level Architecture

1. User authenticates using JWT.
2. Client establishes a WebSocket (Socket.io) connection.
3. User creates or joins a meeting.
4. WebRTC signaling (Offer / Answer / ICE) is exchanged via Socket.io.
5. Media streams are sent to the SFU server.
6. The SFU selectively forwards streams to other participants.
7. UI updates in real time as peers connect or disconnect.

Media never flows through REST APIs; only signaling does.

---

## WebRTC Flow (Simplified)

* `getUserMedia()` captures camera and microphone.
* `RTCPeerConnection` manages peer connections.
* SDP describes media capabilities.
* ICE finds optimal network paths.
* Socket.io handles signaling only.
* Actual media is transported via WebRTC and routed by the SFU.

---

## Why SFU?

Selective Forwarding Unit (SFU):

* Receives streams from all participants.
* Forwards them without re-encoding.
* Low latency and low CPU usage.
* Scales significantly better than mesh topology.
* Industry standard used by Zoom, Google Meet, Microsoft Teams.

---

## Tech Stack

### Backend

* Node.js, Express.js
* Socket.io
* WebRTC SFU
* MongoDB + Mongoose
* JWT Authentication
* TypeScript

### Frontend

* Next.js
* Tailwind CSS
* ShadCN UI
* Zustand (state management)
* Socket.io Client
* WebRTC APIs
* Zod + React Hook Form

---

## Project Structure

### Backend

```
backend/
  ├── services/        # SFU & signaling logic
  ├── routes/          # Auth & meeting APIs
  ├── middleware/      # JWT, validation
  ├── models/          # MongoDB schemas
  └── index.ts         # App entry
```

### Frontend

```
frontend/
  ├── app/             # Next.js routing
  ├── components/     # UI components
  ├── services/       # WebRTC & Socket logic
  ├── state/          # Global state (Zustand)
  └── api/            # API clients
```

---

## Setup (Local Development)

### Prerequisites

* Node.js v18+
* MongoDB
* npm or yarn

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### MongoDB

```bash
mongod
```

---

## Environment Variables

```
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/relayrtc
JWT_SECRET=your_secret
ALLOWED_ORIGINS=http://localhost:3001
```

---

## Future Improvements

* In-meeting chat
* Meeting recording
* Host moderation tools
* TURN server integration
* Horizontal scaling with Redis and multiple SFU instances

---

## License

MIT License
