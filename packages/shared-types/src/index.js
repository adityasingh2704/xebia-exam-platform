"use strict";
// ============================================
// Xe-Recruiters — Shared Types & DTOs
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventTopics = exports.NavigationRule = exports.TrustScoreLevel = exports.IncidentType = exports.DifficultyLevel = exports.QuestionType = exports.ExamStatus = exports.TenantStatus = exports.UserRole = void 0;
// ── RBAC Roles ──
var UserRole;
(function (UserRole) {
    UserRole["PLATFORM_ADMIN"] = "PLATFORM_ADMIN";
    UserRole["TENANT_ADMIN"] = "TENANT_ADMIN";
    UserRole["EXAM_MANAGER"] = "EXAM_MANAGER";
    UserRole["TEACHER"] = "TEACHER";
    UserRole["PROCTOR"] = "PROCTOR";
    UserRole["CANDIDATE"] = "CANDIDATE";
})(UserRole || (exports.UserRole = UserRole = {}));
// ── Tenant Status ──
var TenantStatus;
(function (TenantStatus) {
    TenantStatus["ACTIVE"] = "ACTIVE";
    TenantStatus["INACTIVE"] = "INACTIVE";
    TenantStatus["SUSPENDED"] = "SUSPENDED";
    TenantStatus["TRIAL"] = "TRIAL";
})(TenantStatus || (exports.TenantStatus = TenantStatus = {}));
// ── Exam Status ──
var ExamStatus;
(function (ExamStatus) {
    ExamStatus["DRAFT"] = "DRAFT";
    ExamStatus["PUBLISHED"] = "PUBLISHED";
    ExamStatus["SCHEDULED"] = "SCHEDULED";
    ExamStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ExamStatus["COMPLETED"] = "COMPLETED";
    ExamStatus["ARCHIVED"] = "ARCHIVED";
})(ExamStatus || (exports.ExamStatus = ExamStatus = {}));
// ── Question Types ──
var QuestionType;
(function (QuestionType) {
    QuestionType["MCQ"] = "MCQ";
    QuestionType["MRQ"] = "MRQ";
    QuestionType["PROGRAMMING"] = "PROGRAMMING";
    QuestionType["TRUE_FALSE"] = "TRUE_FALSE";
    QuestionType["SHORT_ANSWER"] = "SHORT_ANSWER";
    QuestionType["ESSAY"] = "ESSAY";
})(QuestionType || (exports.QuestionType = QuestionType = {}));
// ── Difficulty Levels ──
var DifficultyLevel;
(function (DifficultyLevel) {
    DifficultyLevel["EASY"] = "EASY";
    DifficultyLevel["MEDIUM"] = "MEDIUM";
    DifficultyLevel["HARD"] = "HARD";
    DifficultyLevel["EXPERT"] = "EXPERT";
})(DifficultyLevel || (exports.DifficultyLevel = DifficultyLevel = {}));
// ── Proctoring Incident Types ──
var IncidentType;
(function (IncidentType) {
    IncidentType["FACE_ABSENT"] = "FACE_ABSENT";
    IncidentType["MULTIPLE_FACES"] = "MULTIPLE_FACES";
    IncidentType["HEAD_POSE_DEVIATION"] = "HEAD_POSE_DEVIATION";
    IncidentType["EYE_GAZE_DEVIATION"] = "EYE_GAZE_DEVIATION";
    IncidentType["TAB_SWITCH"] = "TAB_SWITCH";
    IncidentType["WINDOW_BLUR"] = "WINDOW_BLUR";
    IncidentType["CLIPBOARD_ACCESS"] = "CLIPBOARD_ACCESS";
    IncidentType["SCREEN_SHARE_STOPPED"] = "SCREEN_SHARE_STOPPED";
    IncidentType["CAMERA_DISCONNECTED"] = "CAMERA_DISCONNECTED";
    IncidentType["MIC_ANOMALY"] = "MIC_ANOMALY";
    IncidentType["NETWORK_INTERRUPTION"] = "NETWORK_INTERRUPTION";
})(IncidentType || (exports.IncidentType = IncidentType = {}));
// ── Trust Score Level ──
var TrustScoreLevel;
(function (TrustScoreLevel) {
    TrustScoreLevel["HIGH"] = "HIGH";
    TrustScoreLevel["MEDIUM"] = "MEDIUM";
    TrustScoreLevel["LOW"] = "LOW";
    TrustScoreLevel["CRITICAL"] = "CRITICAL";
})(TrustScoreLevel || (exports.TrustScoreLevel = TrustScoreLevel = {}));
// ── Navigation Rules ──
var NavigationRule;
(function (NavigationRule) {
    NavigationRule["FREE"] = "FREE";
    NavigationRule["LINEAR"] = "LINEAR";
    NavigationRule["SECTION_LOCKED"] = "SECTION_LOCKED";
})(NavigationRule || (exports.NavigationRule = NavigationRule = {}));
exports.EventTopics = {
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
    USER_INVITED: 'user.invited',
    TENANT_CREATED: 'tenant.created',
    TENANT_UPDATED: 'tenant.updated',
    EXAM_CREATED: 'exam.created',
    EXAM_PUBLISHED: 'exam.published',
    EXAM_STARTED: 'exam.started',
    EXAM_COMPLETED: 'exam.completed',
    QUESTION_CREATED: 'question.created',
    QUESTION_UPDATED: 'question.updated',
    SESSION_STARTED: 'session.started',
    SESSION_SUBMITTED: 'session.submitted',
    PROCTOR_INCIDENT: 'proctor.incident',
    AUDIT_LOG: 'audit.log',
};
