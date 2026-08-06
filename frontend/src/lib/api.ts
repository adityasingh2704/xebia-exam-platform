import axios from 'axios';

// Each service called directly — bypasses the broken API gateway proxy
const AUTH_URL   = 'http://localhost:3001/api/v1';
const TENANT_URL = 'http://localhost:3002/api/v1';
const USER_URL   = 'http://localhost:3003/api/v1';
const EXAM_URL   = 'http://localhost:3004/api/v1';
const QUESTION_URL = 'http://localhost:3005/api/v1';

// Helper to attach auth token to any axios instance
const attachToken = (config: any) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('xe_access_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
};

// Generic factory for a service axios instance
function makeClient(baseURL: string) {
  const client = axios.create({ baseURL, timeout: 30000, headers: { 'Content-Type': 'application/json' } });
  client.interceptors.request.use(attachToken, (e) => Promise.reject(e));
  return client;
}

export const api        = makeClient(EXAM_URL);   // legacy default (kept for compatibility)
export const authAxios  = makeClient(AUTH_URL);
export const tenantAxios = makeClient(TENANT_URL);
export const userAxios  = makeClient(USER_URL);
export const examAxios  = makeClient(EXAM_URL);
export const questionAxios = makeClient(QUESTION_URL);

// ── Auth API ──────────────────────────────────

export const authApi = {
  register: (data: Record<string, unknown>) =>
    authAxios.post('/auth/register', data),

  login: (email: string, password: string, tenantSlug?: string) =>
    authAxios.post('/auth/login', { email, password, tenantSlug }),

  refresh: (refreshToken: string) =>
    authAxios.post('/auth/refresh', { refreshToken }),

  logout: (refreshToken?: string) =>
    authAxios.post('/auth/logout', { refreshToken }),

  requestPasswordReset: (email: string) =>
    authAxios.post('/auth/password-reset/request', { email }),

  confirmPasswordReset: (token: string, newPassword: string) =>
    authAxios.post('/auth/password-reset/confirm', { token, newPassword }),

  firstLoginReset: (currentPassword: string, newPassword: string, confirmPassword: string) =>
    authAxios.post('/auth/first-login-reset', { currentPassword, newPassword, confirmPassword }),

  verifyToken: () =>
    authAxios.post('/auth/verify-token'),
};

// ── Question Bank API ─────────────────────────

export const questionApi = {
  list: (params?: Record<string, unknown>) =>
    questionAxios.get('/questions', { params }),

  getById: (id: string) =>
    questionAxios.get(`/questions/${id}`),

  create: (data: Record<string, unknown>) =>
    questionAxios.post('/questions', data),

  update: (id: string, data: Record<string, unknown>) =>
    questionAxios.put(`/questions/${id}`, data),

  delete: (id: string) =>
    questionAxios.delete(`/questions/${id}`),

  import: (data: Record<string, unknown>[]) =>
    questionAxios.post('/questions/import', { questions: data }),
};

// ── Exam API ──────────────────────────────────

export const examApi = {
  list: (params?: Record<string, unknown>) =>
    examAxios.get('/exams', { params }),

  getById: (id: string) =>
    examAxios.get(`/exams/${id}`),

  create: (data: Record<string, unknown>) =>
    examAxios.post('/exams', data),

  update: (id: string, data: Record<string, unknown>) =>
    examAxios.put(`/exams/${id}`, data),

  delete: (id: string) =>
    examAxios.delete(`/exams/${id}`),

  publish: (id: string) =>
    examAxios.post(`/exams/${id}/publish`),

  addSection: (examId: string, data: Record<string, unknown>) =>
    examAxios.post(`/exams/${examId}/sections`, data),

  updateSection: (examId: string, sectionId: string, data: Record<string, unknown>) =>
    examAxios.put(`/exams/${examId}/sections/${sectionId}`, data),

  addQuestion: (examId: string, sectionId: string, data: Record<string, unknown>) =>
    examAxios.post(`/exams/${examId}/sections/${sectionId}/questions`, data),

  assign: (examId: string, data: Record<string, unknown>) =>
    examAxios.post(`/exams/${examId}/assign`, data),

  getAssignments: (examId: string) =>
    examAxios.get(`/exams/${examId}/assignments`),

  submitAttempt: (examId: string, candidateId: string, answers: string, totalMarks?: number) =>
    examAxios.post(`/exams/${examId}/submit`, { candidateId, answers, totalMarks }),

  gradeAttempt: (assignmentId: string, score: number, status?: string) =>
    examAxios.post(`/exams/assignments/${assignmentId}/grade`, { score, status }),

  listAssignments: (params: Record<string, unknown>) =>
    examAxios.get('/exams/assignments/all', { params }),

  issueCertificate: (assignmentId: string, candidateName?: string, issuingOrg?: string) =>
    examAxios.post(`/exams/assignments/${assignmentId}/issue-certificate`, { candidateName, issuingOrg }),

  getMyCertificates: (tenantId: string, candidateId: string) =>
    examAxios.get('/exams/certificates/my', { params: { tenantId, candidateId } }),

  verifyCertificate: (hash: string) =>
    examAxios.get(`/exams/certificates/verify/${hash}`),

  get: (id: string) =>
    examAxios.get(`/exams/${id}`),

  postOnboardingLogs: (assignmentId: string, onboardingLogs: any) =>
    examAxios.post(`/exams/assignments/${assignmentId}/onboarding`, { onboardingLogs }),

  getIncidents: (assignmentId: string) =>
    examAxios.get(`/exams/assignments/${assignmentId}/incidents`),

  reviewIncident: (incidentId: string, reviewerDecision: string, reviewerReason?: string, reviewerIdentity?: string) =>
    examAxios.put(`/exams/incidents/${incidentId}/review`, { reviewerDecision, reviewerReason, reviewerIdentity }),

  getProctorSessions: (examId: string) =>
    examAxios.get(`/exams/${examId}/proctoring/sessions`),

  getProctorDetail: (assignmentId: string) =>
    examAxios.get(`/exams/assignments/${assignmentId}/proctor-detail`),

  warnCandidate: (assignmentId: string, message: string, proctorId?: string) =>
    examAxios.post(`/exams/assignments/${assignmentId}/warn`, { message, proctorId }),

  terminateCandidate: (assignmentId: string, reason: string, note?: string, proctorId?: string, candidateId?: string, examId?: string) =>
    examAxios.post(`/exams/assignments/${assignmentId}/terminate`, { reason, note, proctorId, candidateId, examId }),

  reviewIncidentWithAudit: (incidentId: string, reviewerDecision: string, reviewerReason?: string, reviewerIdentity?: string) =>
    examAxios.post(`/exams/incidents/${incidentId}/decision`, { reviewerDecision, reviewerReason, reviewerIdentity }),

  updateProctoringConfig: (examId: string, data: Record<string, unknown>) =>
    examAxios.put(`/exams/${examId}/proctoring-config`, data),
};

// ── User API ──────────────────────────────────

export const userApi = {
  list: (params?: Record<string, unknown>) =>
    userAxios.get('/users', { params }),

  getById: (id: string) =>
    userAxios.get(`/users/${id}`),

  create: (data: Record<string, unknown>) =>
    userAxios.post('/users', data),

  update: (id: string, data: Record<string, unknown>) =>
    userAxios.put(`/users/${id}`, data),

  delete: (id: string) =>
    userAxios.delete(`/users/${id}`),

  invite: (data: Record<string, unknown>) =>
    userAxios.post('/users/invite', data),

  import: (tenantId: string, users: Record<string, unknown>[]) =>
    userAxios.post('/users/import', { tenantId, users }),
};

// ── Tenant API ────────────────────────────────

export const tenantApi = {
  list: (params?: Record<string, unknown>) =>
    tenantAxios.get('/tenants', { params }),

  getById: (id: string) =>
    tenantAxios.get(`/tenants/${id}`),

  getCurrent: () =>
    tenantAxios.get('/tenants/current'),

  getSystemHealth: () =>
    tenantAxios.get('/tenants/system/health'),

  create: (data: Record<string, unknown>) =>
    tenantAxios.post('/tenants', data),

  update: (id: string, data: Record<string, unknown>) =>
    tenantAxios.put(`/tenants/${id}`, data),

  updateBranding: (id: string, data: Record<string, unknown>) =>
    tenantAxios.put(`/tenants/${id}/branding`, data),

  updateSettings: (id: string, data: Record<string, unknown>) =>
    tenantAxios.put(`/tenants/${id}/settings`, data),

  delete: (id: string) =>
    tenantAxios.delete(`/tenants/${id}`),

  getApiKeys: (tenantId: string) =>
    tenantAxios.get(`/tenants/${tenantId}/api-keys`),

  createApiKey: (tenantId: string, name: string) =>
    tenantAxios.post(`/tenants/${tenantId}/api-keys`, { name }),

  deleteApiKey: (id: string) =>
    tenantAxios.delete(`/tenants/api-keys/${id}`),

  getWebhooks: (tenantId: string) =>
    tenantAxios.get(`/tenants/${tenantId}/webhooks`),

  createWebhook: (tenantId: string, url: string) =>
    tenantAxios.post(`/tenants/${tenantId}/webhooks`, { url }),

  deleteWebhook: (id: string) =>
    tenantAxios.delete(`/tenants/webhooks/${id}`),

  getSecurityPolicy: (tenantId: string) =>
    tenantAxios.get(`/tenants/${tenantId}/security-policy`),

  updateSecurityPolicy: (tenantId: string, data: Record<string, unknown>) =>
    tenantAxios.put(`/tenants/${tenantId}/security-policy`, data),

  getSmtpConfig: (tenantId: string) =>
    tenantAxios.get(`/tenants/${tenantId}/smtp`),

  updateSmtpConfig: (tenantId: string, data: Record<string, unknown>) =>
    tenantAxios.put(`/tenants/${tenantId}/smtp`, data),

  getAuditLogs: (tenantId: string) =>
    tenantAxios.get(`/tenants/${tenantId}/audit-logs`),

  createAuditLog: (tenantId: string, data: Record<string, unknown>) =>
    tenantAxios.post(`/tenants/${tenantId}/audit-logs`, data),
};

// ── Code Execution API ────────────────────────

export const codeExecutionApi = {
  submit: (data: Record<string, unknown>) =>
    examAxios.post('/code-execution/submit', data),

  submitAsync: (data: Record<string, unknown>) =>
    examAxios.post('/code-execution/submit-async', data),

  getSubmission: (token: string) =>
    examAxios.get(`/code-execution/submissions/${token}`),

  runTests: (data: Record<string, unknown>) =>
    examAxios.post('/code-execution/run-tests', data),

  runTestCases: (data: Record<string, unknown>) =>
    examAxios.post('/code-execution/run-tests', data),

  batch: (data: Record<string, unknown>) =>
    examAxios.post('/code-execution/batch', data),

  getLanguages: () =>
    examAxios.get('/code-execution/languages'),
};

// ── Certificates API ──────────────────────────
export const certificateApi = {
  getByAssignmentId: (assignmentId: string) =>
    examAxios.get(`/exams/certificates/assignment/${assignmentId}`),

  listByCandidateId: (candidateId: string) =>
    examAxios.get(`/exams/certificates/candidate/${candidateId}`),

  verify: (id: string) =>
    examAxios.get(`/exams/certificates/${id}/verify`),

  getDownloadUrl: (id: string) =>
    `${EXAM_URL}/exams/certificates/${id}/download`,

  getDownloadUrlByAssignment: (assignmentId: string) =>
    `${EXAM_URL}/exams/certificates/assignment/${assignmentId}/download`,
};


