import { WorkspaceManager } from "./workspaces";
import { useApp } from "../store/app";
export default function TeamWorkspaces() {
  const identity = useApp((s) => s.identity);
  return <WorkspaceManager key={identity} identity={identity} kind="team" />;
}
