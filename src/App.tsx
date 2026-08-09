import { Route, Routes } from "react-router-dom";
import { Activity } from "./app/Activity";
import { AppLayout } from "./app/AppLayout";
import { Agents } from "./app/Agents";
import { Ask } from "./app/Ask";
import { Companies } from "./app/Companies";
import { CompanyDetail } from "./app/CompanyDetail";
import { ContactDetail } from "./app/ContactDetail";
import { Contacts } from "./app/Contacts";
import { Dashboard } from "./app/Dashboard";
import { Deals } from "./app/Deals";
import { Settings } from "./app/Settings";
import { Compare } from "./pages/Compare";
import { Docs } from "./pages/Docs";
import { Landing } from "./pages/Landing";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/compare" element={<Compare />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="companies/:companyId" element={<CompanyDetail />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="contacts/:contactId" element={<ContactDetail />} />
        <Route path="deals" element={<Deals />} />
        <Route path="ask" element={<Ask />} />
        <Route path="activity" element={<Activity />} />
        <Route path="agents" element={<Agents />} />
        <Route path="settings/:section?" element={<Settings />} />
      </Route>
    </Routes>
  );
}
