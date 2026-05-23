import { apiClient } from './client.js';

export const PROJECT_MEMBER_ROLE = Object.freeze({
  OWNER: 'OWNER',
  MEMBER: 'MEMBER',
});

export class ProjectModel {
  constructor(data = {}) {
    this.id = data.id ?? '';
    this.owner_id = data.owner_id ?? '';
    this.name = data.name ?? '';
    this.description = data.description ?? null;
    this.color = data.color ?? '#6ea8fe';
    this.created_at = data.created_at ?? null;
    this.updated_at = data.updated_at ?? null;
  }

  static fromApi(data) {
    return new ProjectModel(data);
  }
}

export class ProjectMemberModel {
  constructor(data = {}) {
    this.id = data.id ?? '';
    this.project_id = data.project_id ?? '';
    this.user_id = data.user_id ?? '';
    this.first_name = data.first_name ?? null;
    this.last_name = data.last_name ?? null;
    this.email = data.email ?? null;
    this.role = data.role ?? PROJECT_MEMBER_ROLE.MEMBER;
    this.invited_by_user_id = data.invited_by_user_id ?? null;
    this.joined_at = data.joined_at ?? null;
    this.created_at = data.created_at ?? null;
  }

  static fromApi(data) {
    return new ProjectMemberModel(data);
  }
}

export class ProjectInviteResponse {
  constructor(data = {}) {
    this.invitation = data.invitation ?? null;
    this.member = data.member ? ProjectMemberModel.fromApi(data.member) : null;
  }
}

export class ProjectsApi {
  async getProjects() {
    const data = await apiClient.get('/projects/');
    if (!Array.isArray(data)) return [];
    return data.map((item) => ProjectModel.fromApi(item));
  }

  async createProject(projectData) {
    const data = await apiClient.post('/projects/', {
      name: projectData?.name ?? '',
      description: projectData?.description || null,
      color: projectData?.color || '#6ea8fe',
    });
    return ProjectModel.fromApi(data);
  }

  async updateProject(projectId, projectData) {
    const data = await apiClient.put(`/projects/${projectId}`, {
      name: projectData?.name,
      description: projectData?.description,
      color: projectData?.color,
    });
    return ProjectModel.fromApi(data);
  }

  async deleteProject(projectId) {
    return apiClient.delete(`/projects/${projectId}`);
  }

  async getProjectMembers(projectId) {
    const data = await apiClient.get(`/projects/${projectId}/members`);
    if (!Array.isArray(data)) return [];
    return data.map((item) => ProjectMemberModel.fromApi(item));
  }

  async inviteProjectMember(projectId, email) {
    const data = await apiClient.post(`/projects/${projectId}/invite`, { email });
    return new ProjectInviteResponse(data);
  }
}

export const projectsApi = new ProjectsApi();
