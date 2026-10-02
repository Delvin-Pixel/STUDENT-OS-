import { NEXA_VERSION } from '@/lib/version';

export const NEXA_PROVIDER_CONTRACT_VERSION = '1.0' as const;
export const NEXA_STUDENT_OS_ACADEMIC_AUTHORITY = 'student-os-learning-intelligence' as const;

export const NEXA_PROVIDER_CAPABILITIES = [
  'chat',
  'explain',
  'tutor',
  'generateMaterial',
  'generateQuiz',
  'coach',
] as const;

export const NEXA_PROVIDER_POLICY = Object.freeze({
  academicDecisionAuthority: NEXA_STUDENT_OS_ACADEMIC_AUTHORITY,
  mayOverrideAcademicDecisions: false,
  studentOsCoreRequiresNexa: false,
} as const);

export type NexaProviderCapability = (typeof NEXA_PROVIDER_CAPABILITIES)[number];

export type NexaAcademicContext = Readonly<{
  authority: typeof NEXA_STUDENT_OS_ACADEMIC_AUTHORITY;
  snapshotId?: string | null;
  evidence: readonly string[];
  constraints?: readonly string[];
}>;

export type NexaProviderRequest = Readonly<{
  requestId: string;
  userId: string;
  prompt: string;
  conversationId?: string | null;
  projectId?: string | null;
  locale?: string | null;
  academicContext?: NexaAcademicContext | null;
}>;

export type NexaProviderMetadata = Readonly<{
  contractVersion: typeof NEXA_PROVIDER_CONTRACT_VERSION;
  nexaVersion: string;
  capability: NexaProviderCapability;
  academicDecisionAuthority: typeof NEXA_STUDENT_OS_ACADEMIC_AUTHORITY;
}>;

export type NexaProviderSuccess = Readonly<{
  ok: true;
  requestId: string;
  capability: NexaProviderCapability;
  content: string;
  suggestions?: readonly string[];
  metadata: NexaProviderMetadata;
}>;

export type NexaProviderFailureCode = 'unavailable' | 'timeout' | 'rate_limited' | 'error';

export type NexaProviderFailure = Readonly<{
  ok: false;
  requestId: string;
  capability: NexaProviderCapability;
  code: NexaProviderFailureCode;
  retryable: boolean;
}>;

export type NexaProviderResult = NexaProviderSuccess | NexaProviderFailure;

export interface NexaProvider {
  readonly id: 'nexa';
  readonly contractVersion: typeof NEXA_PROVIDER_CONTRACT_VERSION;
  readonly capabilities: readonly NexaProviderCapability[];

  chat(request: NexaProviderRequest): Promise<NexaProviderResult>;
  explain(request: NexaProviderRequest): Promise<NexaProviderResult>;
  tutor(request: NexaProviderRequest): Promise<NexaProviderResult>;
  generateMaterial(request: NexaProviderRequest): Promise<NexaProviderResult>;
  generateQuiz(request: NexaProviderRequest): Promise<NexaProviderResult>;
  coach(request: NexaProviderRequest): Promise<NexaProviderResult>;
}

export function createNexaProviderFailure(
  capability: NexaProviderCapability,
  requestId: string,
  code: NexaProviderFailureCode,
  retryable = code === 'timeout' || code === 'rate_limited',
): NexaProviderFailure {
  return Object.freeze({
    ok: false,
    requestId,
    capability,
    code,
    retryable,
  });
}

export function createNexaProviderMetadata(capability: NexaProviderCapability): NexaProviderMetadata {
  return Object.freeze({
    contractVersion: NEXA_PROVIDER_CONTRACT_VERSION,
    nexaVersion: NEXA_VERSION,
    capability,
    academicDecisionAuthority: NEXA_STUDENT_OS_ACADEMIC_AUTHORITY,
  });
}

function hasExactCapabilities(value: unknown): value is readonly NexaProviderCapability[] {
  return Array.isArray(value)
    && value.length === NEXA_PROVIDER_CAPABILITIES.length
    && NEXA_PROVIDER_CAPABILITIES.every((capability, index) => value[index] === capability);
}

export function isNexaProvider(value: unknown): value is NexaProvider {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.id !== 'nexa') return false;
  if (candidate.contractVersion !== NEXA_PROVIDER_CONTRACT_VERSION) return false;
  if (!hasExactCapabilities(candidate.capabilities)) return false;
  return NEXA_PROVIDER_CAPABILITIES.every((capability) => typeof candidate[capability] === 'function');
}
