export declare enum UserRole {
    PLATFORM_ADMIN = "PLATFORM_ADMIN",
    TENANT_ADMIN = "TENANT_ADMIN",
    EXAM_MANAGER = "EXAM_MANAGER",
    TEACHER = "TEACHER",
    PROCTOR = "PROCTOR",
    CANDIDATE = "CANDIDATE"
}
export declare enum TenantStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    SUSPENDED = "SUSPENDED",
    TRIAL = "TRIAL"
}
export declare enum ExamStatus {
    DRAFT = "DRAFT",
    PUBLISHED = "PUBLISHED",
    SCHEDULED = "SCHEDULED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    ARCHIVED = "ARCHIVED"
}
export declare enum QuestionType {
    MCQ = "MCQ",
    MRQ = "MRQ",
    PROGRAMMING = "PROGRAMMING",
    TRUE_FALSE = "TRUE_FALSE",
    SHORT_ANSWER = "SHORT_ANSWER",
    ESSAY = "ESSAY"
}
export declare enum DifficultyLevel {
    EASY = "EASY",
    MEDIUM = "MEDIUM",
    HARD = "HARD",
    EXPERT = "EXPERT"
}
export declare enum IncidentType {
    FACE_ABSENT = "FACE_ABSENT",
    MULTIPLE_FACES = "MULTIPLE_FACES",
    HEAD_POSE_DEVIATION = "HEAD_POSE_DEVIATION",
    EYE_GAZE_DEVIATION = "EYE_GAZE_DEVIATION",
    TAB_SWITCH = "TAB_SWITCH",
    WINDOW_BLUR = "WINDOW_BLUR",
    CLIPBOARD_ACCESS = "CLIPBOARD_ACCESS",
    SCREEN_SHARE_STOPPED = "SCREEN_SHARE_STOPPED",
    CAMERA_DISCONNECTED = "CAMERA_DISCONNECTED",
    MIC_ANOMALY = "MIC_ANOMALY",
    NETWORK_INTERRUPTION = "NETWORK_INTERRUPTION"
}
export declare enum TrustScoreLevel {
    HIGH = "HIGH",
    MEDIUM = "MEDIUM",
    LOW = "LOW",
    CRITICAL = "CRITICAL"
}
export declare enum NavigationRule {
    FREE = "FREE",
    LINEAR = "LINEAR",
    SECTION_LOCKED = "SECTION_LOCKED"
}
export interface PaginationParams {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
    timestamp: string;
}
export interface JwtPayload {
    sub: string;
    email: string;
    tenantId: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}
export interface TenantContext {
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
}
export interface LoginRequest {
    email: string;
    password: string;
    tenantSlug?: string;
}
export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: UserRole;
        tenantId: string;
        requiresPasswordReset: boolean;
    };
}
export interface RefreshTokenRequest {
    refreshToken: string;
}
export interface PasswordResetRequest {
    email: string;
}
export interface PasswordResetConfirmRequest {
    token: string;
    newPassword: string;
}
export interface FirstLoginResetRequest {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}
export interface CreateTenantRequest {
    name: string;
    slug: string;
    adminEmail: string;
    adminFirstName: string;
    adminLastName: string;
    plan?: string;
}
export interface UpdateTenantBrandingRequest {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    companyName?: string;
}
export interface UpdateTenantSettingsRequest {
    timezone?: string;
    locale?: string;
    dateFormat?: string;
    enableEmailNotifications?: boolean;
    enableInAppNotifications?: boolean;
    enableProctoring?: boolean;
    maxConcurrentExams?: number;
}
export interface CreateUserRequest {
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    sendInvitation?: boolean;
}
export interface UpdateUserRequest {
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    isActive?: boolean;
}
export interface InviteUsersRequest {
    users: Array<{
        email: string;
        firstName: string;
        lastName: string;
        role: UserRole;
    }>;
}
export interface BulkImportUsersRequest {
    fileUrl: string;
    defaultRole: UserRole;
    sendInvitations: boolean;
}
export interface CreateQuestionRequest {
    type: QuestionType;
    title: string;
    body: string;
    difficulty: DifficultyLevel;
    points: number;
    tags: string[];
    categoryId?: string;
    explanation?: string;
    options?: QuestionOption[];
    correctAnswer?: string;
    timeLimit?: number;
}
export interface QuestionOption {
    id?: string;
    text: string;
    isCorrect: boolean;
    order: number;
}
export interface UpdateQuestionRequest extends Partial<CreateQuestionRequest> {
}
export interface QuestionFilterParams extends PaginationParams {
    type?: QuestionType;
    difficulty?: DifficultyLevel;
    tags?: string[];
    categoryId?: string;
    search?: string;
}
export interface CreateExamRequest {
    title: string;
    description?: string;
    instructions?: string;
    duration: number;
    passingScore: number;
    totalMarks: number;
    startTime?: string;
    endTime?: string;
    navigationRule: NavigationRule;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: boolean;
    enableProctoring: boolean;
    maxAttempts: number;
    sections: CreateExamSectionRequest[];
}
export interface CreateExamSectionRequest {
    title: string;
    description?: string;
    order: number;
    questionIds: string[];
    timeLimit?: number;
}
export interface UpdateExamRequest extends Partial<CreateExamRequest> {
}
export interface AssignCandidatesRequest {
    candidateIds?: string[];
    candidateEmails?: string[];
    groupIds?: string[];
}
export interface ExamFilterParams extends PaginationParams {
    status?: ExamStatus;
    search?: string;
    startDate?: string;
    endDate?: string;
}
export interface DomainEvent<T = unknown> {
    eventId: string;
    eventType: string;
    timestamp: string;
    tenantId: string;
    actorId: string;
    payload: T;
}
export declare const EventTopics: {
    readonly USER_CREATED: "user.created";
    readonly USER_UPDATED: "user.updated";
    readonly USER_INVITED: "user.invited";
    readonly TENANT_CREATED: "tenant.created";
    readonly TENANT_UPDATED: "tenant.updated";
    readonly EXAM_CREATED: "exam.created";
    readonly EXAM_PUBLISHED: "exam.published";
    readonly EXAM_STARTED: "exam.started";
    readonly EXAM_COMPLETED: "exam.completed";
    readonly QUESTION_CREATED: "question.created";
    readonly QUESTION_UPDATED: "question.updated";
    readonly SESSION_STARTED: "session.started";
    readonly SESSION_SUBMITTED: "session.submitted";
    readonly PROCTOR_INCIDENT: "proctor.incident";
    readonly AUDIT_LOG: "audit.log";
};
export interface HealthCheckResponse {
    status: 'ok' | 'degraded' | 'down';
    service: string;
    version: string;
    uptime: number;
    timestamp: string;
    checks: {
        database: 'ok' | 'down';
        redis?: 'ok' | 'down';
        kafka?: 'ok' | 'down';
    };
}
