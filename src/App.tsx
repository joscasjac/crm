import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./app/AppLayout";
import { Agents } from "./app/Agents";
import { Companies } from "./app/Companies";
import { CompanyDetail } from "./app/CompanyDetail";
import { ContactDetail } from "./app/ContactDetail";
import { Contacts } from "./app/Contacts";
import { Dashboard } from "./app/Dashboard";
import { Deals } from "./app/Deals";
import { Settings } from "./app/Settings";
import { Compare } from "./pages/Compare";
import { Landing } from "./pages/Landing";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/compare" element={<Compare />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="companies/:companyId" element={<CompanyDetail />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="contacts/:contactId" element={<ContactDetail />} />
        <Route path="deals" element={<Deals />} />
        <Route path="agents" element={<Agents />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
