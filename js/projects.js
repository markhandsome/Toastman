// ===== Projects & Team Management Module =====

const Projects = {
  currentProject: null,

  // Create a new project
  async create(name) {
    const user = Auth.getUser();
    if (!user) return null;

    const email = user.email.toLowerCase();
    const project = {
      id: Storage.uuid(),
      name: name || 'New Project',
      ownerId: user.uid,
      ownerEmail: email,
      members: [
        { email: email, name: user.displayName || email, role: 'owner', joinedAt: Date.now() }
      ],
      memberEmails: [email],
      createdAt: Date.now()
    };

    try {
      await db.collection('projects').doc(project.id).set(project);
      return project;
    } catch (err) {
      console.error('Error creating project:', err);
      return null;
    }
  },

  // Get all projects where current user is a member
  async getUserProjects() {
    const email = Auth.getUserEmail();
    if (!email) return [];

    try {
      // Query using the flat memberEmails array — Firestore supports array-contains on strings
      const snapshot = await db.collection('projects')
        .where('memberEmails', 'array-contains', email.toLowerCase())
        .get();

      const projects = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        data.id = doc.id;
        projects.push(data);
      });
      return projects.sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
      console.error('Error fetching projects:', err);
      return [];
    }
  },

  // Set current active project
  setCurrentProject(project) {
    this.currentProject = project;
    Storage.setSetting('currentProjectId', project.id);
  },

  getCurrentProjectId() {
    if (this.currentProject) return this.currentProject.id;
    return Storage.getSetting('currentProjectId') || null;
  },

  // Invite a member by email
  async inviteMember(projectId, email, role = 'member') {
    email = email.toLowerCase().trim();
    try {
      const doc = await db.collection('projects').doc(projectId).get();
      if (!doc.exists) return { error: 'Project not found' };

      const project = doc.data();

      // Check if already a member
      if (project.memberEmails && project.memberEmails.includes(email)) {
        return { error: 'Already a member' };
      }

      // Add to members array
      project.members.push({
        email: email,
        name: email,
        role: role,
        joinedAt: Date.now()
      });

      // Update flat email list
      if (!project.memberEmails) {
        project.memberEmails = project.members.map(m => (typeof m === 'string' ? m : m.email).toLowerCase());
      } else {
        project.memberEmails.push(email);
      }

      await db.collection('projects').doc(projectId).update({
        members: project.members,
        memberEmails: project.memberEmails
      });

      return { success: true, project };
    } catch (err) {
      console.error('Error inviting member:', err);
      return { error: err.message };
    }
  },

  // Remove a member
  async removeMember(projectId, email) {
    email = email.toLowerCase().trim();
    try {
      const doc = await db.collection('projects').doc(projectId).get();
      if (!doc.exists) return { error: 'Project not found' };

      const project = doc.data();

      // Can't remove owner
      if (project.ownerEmail === email) return { error: 'Cannot remove the project owner' };

      project.members = project.members.filter(m =>
        (typeof m === 'string' ? m : m.email).toLowerCase() !== email
      );
      project.memberEmails = project.members.map(m => (typeof m === 'string' ? m : m.email).toLowerCase());

      await db.collection('projects').doc(projectId).update({
        members: project.members,
        memberEmails: project.memberEmails
      });

      return { success: true };
    } catch (err) {
      console.error('Error removing member:', err);
      return { error: err.message };
    }
  },

  // Update member role
  async updateMemberRole(projectId, email, newRole) {
    try {
      const doc = await db.collection('projects').doc(projectId).get();
      if (!doc.exists) return { error: 'Project not found' };

      const project = doc.data();
      const member = project.members.find(m =>
        (typeof m === 'string' ? m : m.email).toLowerCase() === email.toLowerCase()
      );
      if (!member) return { error: 'Member not found' };
      member.role = newRole;

      await db.collection('projects').doc(projectId).update({
        members: project.members
      });

      return { success: true };
    } catch (err) {
      console.error('Error updating role:', err);
      return { error: err.message };
    }
  },

  // Get project details (fresh from Firestore)
  async getProject(projectId) {
    try {
      const doc = await db.collection('projects').doc(projectId).get();
      if (!doc.exists) return null;
      const data = doc.data();
      data.id = doc.id;

      // Auto-fix: if memberEmails is missing, rebuild it from members
      if (!data.memberEmails && data.members) {
        data.memberEmails = data.members.map(m => (typeof m === 'string' ? m : m.email).toLowerCase());
        await db.collection('projects').doc(projectId).update({ memberEmails: data.memberEmails });
      }

      return data;
    } catch (err) {
      console.error('Error getting project:', err);
      return null;
    }
  },

  // Delete a project (owner only)
  async deleteProject(projectId) {
    try {
      const project = await this.getProject(projectId);
      if (!project) return { error: 'Project not found' };
      if (project.ownerEmail !== Auth.getUserEmail().toLowerCase()) return { error: 'Only the owner can delete the project' };

      // Delete all project data
      const batch = db.batch();

      const colSnap = await db.collection('collections').where('projectId', '==', projectId).get();
      colSnap.forEach(doc => batch.delete(doc.ref));

      const reqSnap = await db.collection('requests').where('projectId', '==', projectId).get();
      reqSnap.forEach(doc => batch.delete(doc.ref));

      const envSnap = await db.collection('environments').where('projectId', '==', projectId).get();
      envSnap.forEach(doc => batch.delete(doc.ref));

      batch.delete(db.collection('projects').doc(projectId));

      await batch.commit();
      return { success: true };
    } catch (err) {
      console.error('Error deleting project:', err);
      return { error: err.message };
    }
  },

  // Check if current user is owner of the project
  isOwner() {
    if (!this.currentProject) return false;
    return this.currentProject.ownerEmail === (Auth.getUserEmail() || '').toLowerCase();
  },

  // Check if current user is admin (owner or admin role)
  isAdmin() {
    if (!this.currentProject) return false;
    const email = (Auth.getUserEmail() || '').toLowerCase();
    const member = this.currentProject.members.find(m =>
      (typeof m === 'string' ? m : m.email).toLowerCase() === email
    );
    if (!member) return false;
    const role = typeof member === 'string' ? 'member' : member.role;
    return role === 'owner' || role === 'admin';
  },

  // Rename project
  async renameProject(projectId, newName) {
    try {
      await db.collection('projects').doc(projectId).update({ name: newName });
      if (this.currentProject && this.currentProject.id === projectId) {
        this.currentProject.name = newName;
      }
      return { success: true };
    } catch (err) {
      console.error('Error renaming project:', err);
      return { error: err.message };
    }
  }
};
