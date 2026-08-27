import { Navigate, Route, Routes } from "react-router-dom";
import { Activity } from "./app/Activity";
import { AppLayout } from "./app/AppLayout";
import { Companies } from "./app/Companies";
import { CompanyDetail } from "./app/CompanyDetail";
import { ContactDetail } from "./app/ContactDetail";
import { Contacts } from "./app/Contacts";
import { CustomObjectPage } from "./app/CustomObjectPage";
import { Dashboard } from "./app/Dashboard";
import { Deals } from "./app/Deals";
import { Notes } from "./app/Notes";
import { ProjectDetail } from "./app/ProjectDetail";
import { Projects } from "./app/Projects";
import { Settings } from "./app/Settings";
import { TaskDetailPage, Tasks } from "./app/Tasks";
import { WorkspaceTimeline } from "./app/WorkspaceTimeline";
import { Trash } from "./app/Trash";
import { Compare } from "./pages/Compare";
import { Docs } from "./pages/Docs";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/compare" element={<Compare />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="timeline" element={<WorkspaceTimeline />} />
        <Route path="companies" element={<Companies />} />
        <Route path="companies/:companyId" element={<CompanyDetail />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="contacts/:contactId" element={<ContactDetail />} />
        <Route path="objects/:objectKey" element={<CustomObjectPage />} />
        <Route path="deals" element={<Deals />} />
        <Route path="notes" element={<Notes />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="activity" element={<Activity />} />
        <Route path="ask" element={<Navigate to="/app" replace />} />
        <Route path="agents" element={<Navigate to="/app" replace />} />
        <Route path="trash" element={<Trash />} />
        <Route path="settings/:section?" element={<Settings />} />
      </Route>
    </Routes>
  );
}
