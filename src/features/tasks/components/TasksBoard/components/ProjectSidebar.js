import React, { useCallback, useMemo } from 'react';
import { ChevronRight, FolderKanban, Loader2, Plus, Send, Trash2, User } from 'lucide-react';
import ColorPicker from '@/components/ui/ColorPicker';

const PROJECT_COLOR_PRESETS = [
  '#94a3b8',
  '#60a5fa',
  '#9ca3af',
  '#fbbf24',
  '#34d399',
  '#f87171',
  '#6b7280',
  '#e879f9',
  '#a78bfa',
  '#2dd4bf',
  '#4ade80',
  '#f97316',
];

function getMemberDisplayName(member) {
  const fullName = [member?.first_name, member?.last_name].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (member?.email) return member.email;

  const value = member?.user_id || '';
  if (!value) return 'Member';
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

export default function ProjectSidebar({
  projects,
  membersByProject,
  projectForm,
  setProjectForm,
  inviteForm,
  setInviteForm,
  selectedProjectId,
  setSelectedProjectId,
  currentUserId,
  onCreateProject,
  onDeleteProject,
  onInviteMember,
  onRemoveMember,
  isCreating,
  isDeleting,
  isInviting,
  removingMemberId,
  isOpen,
  onToggleOpen,
  onOpen,
  onClose,
}) {
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const members = selectedProject ? membersByProject[selectedProject.id] || [] : [];
  const canDeleteSelectedProject =
    Boolean(selectedProject?.owner_id) && selectedProject.owner_id === currentUserId;
  const canManageSelectedProject = canDeleteSelectedProject;

  const handleColorChange = useCallback((nextColor) => {
    setProjectForm((prev) => ({ ...prev, color: nextColor }));
  }, [setProjectForm]);

  return (
    <div
      className={`tasksProjectDrawer ${isOpen ? 'open' : ''}`}
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        className="tasksProjectDrawerRail"
        onClick={onToggleOpen}
        title={isOpen ? 'Hide projects' : 'Show projects'}
        aria-label={isOpen ? 'Hide projects' : 'Show projects'}
      >
        <ChevronRight size={16} />
      </button>

      <aside className={`tasksProjectSidebar ${isOpen ? 'open' : ''}`}>
      <div className="tasksProjectSidebarHead">
        <div className="tasksProjectSidebarTitle">
          <FolderKanban size={14} />
          <span>Projects</span>
        </div>
        <button
          type="button"
          className="tasksIconBtn primary tasksProjectIconBtn"
          onClick={onCreateProject}
          disabled={isCreating}
          title="Create project"
        >
          {isCreating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
        </button>
      </div>

      <div className="tasksProjectCreatePanel">
        <div className="tasksField">
          <label>Name</label>
          <input
            type="text"
            value={projectForm.name}
            onChange={(event) =>
              setProjectForm((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="Project name"
          />
        </div>
        <div className="tasksProjectCreateMeta">
          <div className="tasksField">
            <label>Color</label>
            <ColorPicker
              value={projectForm.color || '#6ea8fe'}
              onChange={handleColorChange}
              presets={PROJECT_COLOR_PRESETS}
            />
          </div>
        </div>
        <div className="tasksField">
          <label>Description</label>
          <input
            type="text"
            value={projectForm.description}
            onChange={(event) =>
              setProjectForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="Optional description"
          />
        </div>
      </div>

      <div className="tasksProjectSidebarList">
        {projects.length === 0 ? (
          <p className="tasksMutedText">No projects yet.</p>
        ) : (
          projects.map((project) => {
            const color = project.color || '#6ea8fe';
            const memberCount = membersByProject[project.id]?.length || 0;
            const isSelected = selectedProjectId === project.id;

            return (
              <button
                key={project.id}
                type="button"
                className={`tasksProjectSideItem ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedProjectId(project.id)}
              >
                <span className="tasksProjectColor" style={{ backgroundColor: color }} />
                <span className="tasksProjectSideText">
                  <strong>{project.name}</strong>
                  <small>{memberCount} member{memberCount === 1 ? '' : 's'}</small>
                </span>
                <ChevronRight size={12} className="tasksProjectSideChevron" />
              </button>
            );
          })
        )}
      </div>

      {selectedProject ? (
        <div className="tasksProjectSidebarDetail">
          <div className="tasksProjectSelectedHeader">
            <div className="tasksProjectInfo">
              <span
                className="tasksProjectColor"
                style={{ backgroundColor: selectedProject.color || '#6ea8fe' }}
              />
              <div>
                <strong>{selectedProject.name}</strong>
                <p>{selectedProject.description || 'No description'}</p>
              </div>
            </div>
            {canDeleteSelectedProject ? (
              <button
                type="button"
                className="tasksIconBtn danger tasksProjectIconBtn"
                onClick={() => onDeleteProject(selectedProject.id)}
                disabled={isDeleting}
                title="Delete project"
              >
                {isDeleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
              </button>
            ) : null}
          </div>

          <div className="tasksProjectMembers">
            {members.length === 0 ? (
              <p className="tasksMutedText">No members yet.</p>
            ) : (
                members.map((member) => (
                  <div key={member.id} className="tasksProjectMemberRow">
                    {canManageSelectedProject && member.role !== 'OWNER' ? (
                      <button
                        type="button"
                        className="tasksProjectMemberDot tasksProjectMemberRemoveDot"
                        onClick={() => onRemoveMember(selectedProject.id, member.id)}
                        disabled={removingMemberId === member.id}
                        title="Remove member"
                      >
                        {removingMemberId === member.id ? (
                          <Loader2 size={13} className="spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    ) : (
                      <span className="tasksProjectMemberDot" />
                    )}
                    <User size={14} />
                    <span>{getMemberDisplayName(member)}</span>
                    <small>{member.role}</small>
                </div>
              ))
            )}
          </div>

          {canManageSelectedProject ? (
            <form
              className="tasksProjectInvite"
              onSubmit={(event) => {
                event.preventDefault();
                onInviteMember();
              }}
            >
              <label>Invite Email</label>
              <div className="tasksProjectInviteRow">
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) =>
                    setInviteForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="teammate@example.com"
                  required
                />
                <button
                  type="submit"
                  className="tasksIconBtn primary tasksProjectIconBtn"
                  disabled={isInviting}
                  title="Send invite"
                >
                  {isInviting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
      </aside>
    </div>
  );
}
