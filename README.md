# TrainApp

A fast, reliable way to log workouts and track progress — built to work in the one place it matters most: mid-workout, in a gym, with unreliable signal and a phone in one hand between sets.

## The Problem

Most fitness-tracking apps ask for too much friction at the exact moment users have the least patience for it — typing, scrolling, waiting on a spinner while the app "syncs." The result is people either stop logging, or log after the fact from memory, which defeats the purpose of tracking in the first place.

## MVP Scope

1. **Log workouts** — exercises, sets, reps, weight — in a few taps, working fully offline.
2. **Track progress** — view workout history and basic trends over time.

Everything else (food tracking, weight tracking, insights/analytics) is deliberately out of scope for v1 and planned as post-MVP phases.

## Stack

- **Backend:** Node.js + TypeScript + [Fastify](https://fastify.dev/)
- **Mobile app:** React Native ([Expo](https://expo.dev/))
- **Data model:** offline-first — local SQLite on-device, syncing to the backend when connectivity is available
- **Testing:** Vitest (backend), Jest (mobile app)

See the project's Decision Log (Notion) for the full rationale behind each stack choice and its tradeoffs.

## Project Structure

```
TrainApp/
├── backend/          # Fastify + TypeScript API
│   ├── src/
│   │   ├── index.ts
│   │   └── __tests__/
│   ├── package.json
│   └── tsconfig.json
└── app/               # React Native (Expo) mobile app — not yet scaffolded
```

## Getting Started (Backend)

**Prerequisites:** Node.js 22+, npm

```bash
cd backend
npm install
```

**Run the dev server:**
```bash
npx tsx src/index.ts
```
Server starts on `http://localhost:3000` (bound to `0.0.0.0` so it's reachable from other devices on the same network, e.g. a phone running Expo Go).

**Verify it's running:**
```bash
curl http://localhost:3000/health
# → {"status":"ok"}
```

**Run tests:**
```bash
npm test
```

**Type-check without emitting output:**
```bash
npx tsc --noEmit
```

## Getting Started (Mobile App)

Not yet scaffolded — coming in a later phase. Will use Expo, testable on a physical iPhone via the Expo Go app with no local Xcode/simulator required.

## Current Status

🚧 **Phase 0 — Environment Setup.** Backend scaffold complete (TypeScript, Fastify, health-check route, Vitest all confirmed working). Mobile app scaffold and data model design are next.

## Development Workflow

This project is built with Claude as a coding mentor, split into:
- **Learning mode** — new concepts, first attempts at a feature, plan-only until the approach is understood
- **Implementation mode** — refactors, repetitive code, multi-file changes, test running

See the project's Notion workspace for the full Decision Log, architecture blueprint, and phase-by-phase task list.