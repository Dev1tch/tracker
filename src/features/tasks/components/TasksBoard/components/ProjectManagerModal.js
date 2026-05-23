import React, { useCallback, useMemo } from 'react';
import { Loader2, Plus, Send, Trash2, User, Users, X } from 'lucide-react';
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

export default function ProjectManagerModal({
  isOpen,
  onClose,
  projects,
  membersByProject,
  projectColors,
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
  isCreating,
  isDeleting,
  isInviting,
}) {
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const members = selectedProject ? membersByProject[selectedProject.id] || [] : [];
  const selectedColor = selectedProject?.color || projectForm.color || '#6ea8fe';
  const canDeleteSelectedProject =
    Boolean(selectedProject?.owner_id) && selectedProject.owner_id === currentUserId;

  const handleColorChange = useCallback((nextColor) => {
    setProjectForm((prev) => ({ ...prev, color: nextColor }));
  }, [setProjectForm]);

  if (!isOpen) return null;

  return (
    <div className="tasksModalOverlay" onClick={onClose}>
      <div className="tasksModal tasksProjectModal" onClick={(e) => e.stopPropagation()}>
        <div className="tasksModalHeader">
          <h3>Projects</h3>
          <div className="tasksModalHeaderActions">
            <button
              type="button"
              className="tasksBtn tasksBtnPrimary tasksBtnCompact"
              onClick={onCreateProject}
              disabled={isCreating}
            >
              {isCreating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
              Create
            </button>
            <button type="button" className="tasksIconBtn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="tasksProjectCreateGrid">
          <div className="tasksField">
            <label>Name</label>
            <input
              type="text"
              value={projectForm.name}
              onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Project name"
            />
          </div>
          <div className="tasksField">
            <label>Color</label>
            <div className="tasksProjectColorField">
              <ColorPicker
                value={projectForm.color || '#6ea8fe'}
                onChange={handleColorChange}
                presets={PROJECT_COLOR_PRESETS}
              />
            </div>
          </div>
          <div className="tasksField tasksFieldFull">
            <label>Description</label>
            <input
              type="text"
              value={projectForm.description}
              onChange={(e) =>
                setProjectForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Optional description"
            />
          </div>
        </div>

        <div className="tasksProjectList">
          {projects.length === 0 ? (
            <p className="tasksMutedText">No projects yet.</p>
          ) : (
            projects.map((project) => {
              const color = project.color || projectColors[project.id] || '#6ea8fe';
              const memberCount = membersByProject[project.id]?.length || 0;
              const isSelected = selectedProjectId === project.id;

              return (
                <button
                  key={project.id}
                  type="button"
                  className={`tasksProjectItem ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedProjectId(isSelected ? '' : project.id)}
                >
                  <div className="tasksProjectInfo">
                    <span className="tasksProjectColor" style={{ backgroundColor: color }} />
                    <div>
                      <strong>{project.name}</strong>
                      <p>{project.description || 'No description'}</p>
                    </div>
                  </div>
                  <span className="tasksProjectCount">
                    <Users size={13} />
                    {memberCount}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {selectedProject ? (
          <div className="tasksProjectSelected">
            <div className="tasksProjectSelectedHeader">
              <div className="tasksProjectInfo">
                <span className="tasksProjectColor" style={{ backgroundColor: selectedColor }} />
                <div>
                  <strong>{selectedProject.name}</strong>
                  <p>{members.length} member{members.length === 1 ? '' : 's'}</p>
                </div>
              </div>
              {canDeleteSelectedProject ? (
                <button
                  type="button"
                  className="tasksIconBtn danger"
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
                    <User size={14} />
                    <span>{getMemberDisplayName(member)}</span>
                    <small>{member.role}</small>
                  </div>
                ))
              )}
            </div>

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
                <button type="submit" className="tasksBtn tasksBtnPrimary" disabled={isInviting}>
                  {isInviting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                  Invite
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
