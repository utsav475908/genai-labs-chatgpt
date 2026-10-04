import { Link, Navigate, useParams } from "react-router-dom";
import { useShowcaseConfig } from "../config/ConfigProvider";
import { HealthBadge } from "./HealthBadge";

// Labs use the mic (voice, transcription) and camera (vision), which an iframe must be granted explicitly.
const LAB_PERMISSIONS = "microphone; camera; clipboard-read; clipboard-write; autoplay";

export function LabPage() {
  const { labId } = useParams();
  const { labs } = useShowcaseConfig();
  const index = labs.findIndex((lab) => lab.id === labId);
  const lab = labs[index];

  // Lab removed or disabled in labs.json while it was open: go back to the first one.
  if (!lab) return <Navigate to="/" replace />;

  const prev = labs[index - 1];
  const next = labs[index + 1];

  return (
    <main className="content">
      <header className="lab-header">
        <div>
          <p className="muted">Lab {index + 1} of {labs.length}</p>
          <h2>
            {lab.name} <HealthBadge url={`${lab.apiUrl}${lab.healthPath}`} />
          </h2>
          <p>{lab.description}</p>
        </div>
        <nav className="pager">
          {prev && <Link to={`/${prev.id}`}>← {prev.name}</Link>}
          <a href={lab.frontendUrl} target="_blank" rel="noreferrer">Open in new tab ↗</a>
          {next && <Link to={`/${next.id}`}>{next.name} →</Link>}
        </nav>
      </header>
      <iframe key={lab.id} className="lab-frame" src={lab.frontendUrl} title={lab.name} allow={LAB_PERMISSIONS} />
    </main>
  );
}
