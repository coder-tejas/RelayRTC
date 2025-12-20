# WebRTC Video Conferencing App

A modern, full-stack video conferencing application built with WebRTC, featuring an SFU (Selective Forwarding Unit) server for scalable multi-party video calls.

## 🚀 Features

### Authentication & User Management
- **JWT-based Authentication**: Secure email/password authentication
- **User Registration & Login**: Complete user management system
- **Protected Routes**: Automatic redirect for unauthenticated users

### Video Conferencing
- **WebRTC SFU Server**: Scalable selective forwarding unit implementation
- **Multi-party Video Calls**: Support for multiple participants
- **Real-time Audio/Video**: High-quality peer-to-peer communication
- **Screen Sharing**: Share your screen with participants
- **Media Controls**: Toggle audio, video, and screen sharing

### Meeting Management
- **Create Meetings**: Generate unique meeting IDs and shareable links
- **Join by Link/Code**: Easy meeting access via URL or meeting ID
- **Meeting History**: View past and active meetings
- **Host Controls**: Meeting management capabilities for hosts

### Real-time Features
- **Socket.io Integration**: Real-time signaling and communication
- **WebRTC Signaling**: ICE, SDP negotiation, and peer management
- **Connection Stats**: Real-time latency, bandwidth, and quality metrics
- **Connection Quality Indicators**: Visual feedback on connection status

### Modern UI/UX
- **ShadCN UI Components**: Modern, accessible component library
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Theme**: Optimized for video conferencing
- **Real-time Notifications**: Toast notifications for user feedback

## 🛠 Tech Stack

### Backend
- **Node.js** with **Express.js** - Server framework
- **Socket.io** - Real-time bidirectional communication
- **MongoDB** with **Mongoose** - Database and ODM
- **JWT** - Authentication and authorization
- **bcryptjs** - Password hashing
- **TypeScript** - Type safety

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **ShadCN UI** - Modern component library
- **Tailwind CSS** - Utility-first CSS framework
- **Zustand** - State management
- **Socket.io Client** - Real-time communication
- **React Hook Form** - Form handling
- **Zod** - Schema validation

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **MongoDB** (v5.0 or higher)
- **npm** or **yarn**

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone <repository-url>
cd webrtc
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

Configure your `.env` file:
```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=https://t3001.tusharsukhwal.com

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/webrtc-app

# JWT Configuration  
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# CORS Configuration
ALLOWED_ORIGINS=https://t3001.tusharsukhwal.com,https://yourdomain.com
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install
```

### 4. Database Setup

Make sure MongoDB is running on your system:

**macOS (with Homebrew):**
```bash
brew services start mongodb/brew/mongodb-community
```

**Ubuntu:**
```bash
sudo systemctl start mongod
```

**Windows:**
Start MongoDB service from Services panel or run:
```bash
net start MongoDB
```

### 5. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The application will be available at:
- **Frontend**: https://t3001.tusharsukhwal.com
- **Backend API**: https://t3000.tusharsukhwal.com

## 📱 Usage

### Getting Started
1. **Register/Login**: Create an account or sign in
2. **Dashboard**: Access your meeting dashboard
3. **Create Meeting**: Start a new video conference
4. **Join Meeting**: Use meeting ID or link to join existing meetings

### Creating a Meeting
1. Click "Create Meeting" on the dashboard
2. Enter a meeting title
3. You'll be redirected to the meeting room
4. Share the meeting link or ID with participants

### Joining a Meeting
- **Via Link**: Click on the meeting link
- **Via Meeting ID**: Enter the meeting ID on the dashboard

### During a Meeting
- **Audio Control**: Toggle microphone on/off
- **Video Control**: Toggle camera on/off
- **Screen Share**: Share your screen with participants
- **Connection Stats**: View real-time connection information
- **Leave Meeting**: End your participation

## 🔧 Development

### Backend Development
```bash
cd backend
npm run dev    # Start with hot reload
npm run build  # Build for production
npm start      # Start production server
```

### Frontend Development
```bash
cd frontend
npm run dev    # Start development server
npm run build  # Build for production
npm start      # Start production server
```

### Database Management
The application automatically creates the required collections and indexes. You can view your data using MongoDB Compass or the MongoDB shell.

## 🏗 Architecture

### Backend Architecture
```
backend/
├── src/
│   ├── models/          # MongoDB models
│   │   ├── User.ts      # User model with authentication
│   │   └── Meeting.ts   # Meeting model
│   ├── routes/          # API routes
│   │   ├── auth.ts      # Authentication endpoints
│   │   └── meetings.ts  # Meeting management endpoints
│   ├── middleware/      # Express middleware
│   │   └── auth.ts      # JWT authentication middleware
│   ├── services/        # Business logic
│   │   └── SFUServer.ts # WebRTC SFU implementation
│   └── index.ts         # Application entry point
```

### Frontend Architecture
```
frontend/src/
├── app/                 # Next.js App Router
│   ├── auth/           # Authentication pages
│   ├── dashboard/      # Dashboard page
│   ├── meeting/        # Meeting room pages
│   └── layout.tsx      # Root layout
├── components/ui/      # ShadCN UI components
├── services/           # External services
│   └── webRTCService.ts # WebRTC client implementation
├── state/              # Global state management
│   └── globalState.ts  # Zustand store
└── api/                # API utilities
    └── api.ts          # Axios configuration and API functions
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **CORS Protection**: Configurable CORS policies
- **Input Validation**: Server-side validation with express-validator
- **Environment Variables**: Secure configuration management

## 📊 Monitoring & Stats

The application provides real-time monitoring of:
- **Connection Latency**: Round-trip time measurement
- **Bandwidth Usage**: Upload and download speeds
- **Connection Quality**: Excellent/Good/Fair/Poor indicators
- **Participant Count**: Active meeting participants
- **Meeting Duration**: Time tracking

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com
MONGODB_URI=mongodb://your-mongodb-server/webrtc-app
JWT_SECRET=your-production-jwt-secret
ALLOWED_ORIGINS=https://yourdomain.com
```

### Building for Production
```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- WebRTC for real-time communication
- Socket.io for signaling server
- ShadCN for beautiful UI components
- Next.js team for the amazing framework
- MongoDB for reliable data storage

## 📞 Support

If you have any questions or need help, please open an issue on GitHub or contact the development team.

---

**Happy video conferencing! 🎥✨** 