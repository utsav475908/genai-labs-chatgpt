import { NavLink } from "react-router-dom";
import { useShowcaseConfig } from "../config/ConfigProvider";

export function Sidebar() {
  const { title, labs } = useShowcaseConfig();
  return (
    <nav className="sidebar">
      <h1>{title}</h1>
      <ol>
        {labs.map((lab) => (
          <li key={lab.id}>
            <NavLink to={`/${lab.id}`}>{lab.name}</NavLink>
          </li>
        ))}
      </ol>
    </nav>
  );
}
