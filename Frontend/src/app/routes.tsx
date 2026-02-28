import React from 'react';
import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Meetings } from "./pages/Meetings";
import { MeetingRoom } from "./pages/MeetingRoom";
import { Schedule } from "./pages/Schedule";
import { Recordings } from "./pages/Recordings";
import { Transcripts } from "./pages/Transcripts";
import { TranscriptViewer } from "./pages/TranscriptViewer";
import { MomViewer } from "./pages/MomViewer";
import { Analytics } from "./pages/Analytics";
import { StudentHome } from "./pages/StudentHome";
import { Settings } from "./pages/Placeholders"; // Using placeholder for now
import { ErrorBoundary } from "./components/ErrorBoundary";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
    errorElement: <ErrorBoundary />
  },
  {
    path: "/meeting/:id",
    element: <MeetingRoom />,
    errorElement: <ErrorBoundary />
  },
  {
    path: "/meeting/active",
    element: <MeetingRoom />,
    errorElement: <ErrorBoundary />
  },
  {
    path: "/meeting/new",
    element: <MeetingRoom />,
    errorElement: <ErrorBoundary />
  },
  {
    element: <Layout role="teacher" />,
    errorElement: <ErrorBoundary />,
    children: [
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/schedule", element: <Schedule /> },
      { path: "/meetings", element: <Meetings /> },
      { path: "/recordings", element: <Recordings /> },
      { path: "/transcripts", element: <Transcripts /> },
      { path: "/recording/:id", element: <TranscriptViewer /> },
      { path: "/mom", element: <MomViewer /> }, // generic list or specific
      { path: "/mom/:id", element: <MomViewer /> },
      { path: "/analytics", element: <Analytics /> },
      { path: "/settings", element: <Settings /> },
    ],
  },
  {
    element: <Layout role="student" />,
    errorElement: <ErrorBoundary />,
    children: [
      { path: "/student-home", element: <StudentHome /> },
      { path: "/join", element: <Login /> },
      { path: "/recordings", element: <Recordings /> },
      { path: "/transcripts", element: <Transcripts /> },
      { path: "/recording/:id", element: <TranscriptViewer /> },
      { path: "/mom", element: <MomViewer /> },
      { path: "/mom/:id", element: <MomViewer /> },
      { path: "/settings", element: <Settings /> },
    ],
  },
]);
