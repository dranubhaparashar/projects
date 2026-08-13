export const LOCAL_AI_DIAGNOSTIC_PREFIX = "[Project Intelligence Local AI]";
export const LOCAL_AI_MODEL_ID = "onnx-community/Qwen2.5-0.5B-Instruct";
export const LOCAL_AI_DTYPE = "q4";
export const LOCAL_AI_DEVICE = "webgpu";
export const LOCAL_AI_BROWSER_CACHE_NAME = "transformers-cache";

export type LocalAiDiagnosticStage =
	| "download"
	| "model-init"
	| "webgpu-init"
	| "webgpu-runtime"
	| "generation";

export interface LocalAiFailureDiagnostic {
	stage: LocalAiDiagnosticStage;
	cause: string;
	model: typeof LOCAL_AI_MODEL_ID;
	dtype: typeof LOCAL_AI_DTYPE;
	device: typeof LOCAL_AI_DEVICE;
	errorName: string;
	errorMessage: string;
	errorStack?: string;
}

interface ErrorFields {
	name: string;
	message: string;
	stack?: string;
}

function errorFields(error: unknown): ErrorFields {
	if (error instanceof Error) {
		return {
			name: error.name || "Error",
			message: error.message || "Local AI failed",
			stack: error.stack || undefined,
		};
	}
	if (error && typeof error === "object") {
		const record = error as Record<string, unknown>;
		return {
			name: typeof record.name === "string" ? record.name : "Error",
			message:
				typeof record.message === "string" ? record.message : "Local AI failed",
			stack: typeof record.stack === "string" ? record.stack : undefined,
		};
	}
	return {
		name: "Error",
		message: typeof error === "string" ? error : "Local AI failed",
	};
}

export function createLocalAiFailureDiagnostic(
	stage: LocalAiDiagnosticStage,
	cause: string,
	error: unknown,
): LocalAiFailureDiagnostic {
	const fields = errorFields(error);
	return {
		stage,
		cause,
		model: LOCAL_AI_MODEL_ID,
		dtype: LOCAL_AI_DTYPE,
		device: LOCAL_AI_DEVICE,
		errorName: fields.name,
		errorMessage: fields.message,
		errorStack: fields.stack,
	};
}

export function logLocalAiFailure(diagnostic: LocalAiFailureDiagnostic): void {
	console.error(
		`Local AI failed: stage=${diagnostic.stage} reason=${diagnostic.cause}`,
	);
	const lines = [
		LOCAL_AI_DIAGNOSTIC_PREFIX,
		`stage: ${diagnostic.stage}`,
		`cause: ${diagnostic.cause}`,
		`model: ${diagnostic.model}`,
		`dtype: ${diagnostic.dtype}`,
		`device: ${diagnostic.device}`,
		`error name: ${diagnostic.errorName}`,
		`error message: ${diagnostic.errorMessage}`,
	];
	if (diagnostic.errorStack) {
		lines.push(`error stack: ${diagnostic.errorStack}`);
	}
	console.error(lines.join("\n"));
	console.error(
		`${LOCAL_AI_DIAGNOSTIC_PREFIX} Local AI failed at ${diagnostic.stage}: ${diagnostic.errorMessage}`,
	);
}

export function errorFromLocalAiDiagnostic(
	diagnostic: LocalAiFailureDiagnostic,
): Error {
	const error = new Error(diagnostic.errorMessage);
	error.name = diagnostic.errorName;
	if (diagnostic.errorStack) error.stack = diagnostic.errorStack;
	return error;
}

export function hasDeviceLostSignature(
	diagnostic: Pick<
		LocalAiFailureDiagnostic,
		"errorName" | "errorMessage" | "errorStack"
	>,
): boolean {
	const value = [
		diagnostic.errorName,
		diagnostic.errorMessage,
		diagnostic.errorStack || "",
	].join(" ");
	return /device\s+(?:is\s+|was\s+|has\s+been\s+)?lost|GPUDevice[^\n]*lost|DXGI_ERROR_DEVICE_(?:HUNG|REMOVED|RESET)/i.test(
		value,
	);
}

export function hasGpuInstanceInvalidationSignature(
	diagnostic: Pick<
		LocalAiFailureDiagnostic,
		"errorName" | "errorMessage" | "errorStack"
	>,
): boolean {
	const value = [
		diagnostic.errorName,
		diagnostic.errorMessage,
		diagnostic.errorStack || "",
	].join(" ");
	return (
		diagnostic.errorName === "AbortError" ||
		hasDeviceLostSignature(diagnostic) ||
		/GPUBuffer[^\n]*mapAsync|mapAsync[^\n]*GPUBuffer|valid external Instance reference no longer exists|external Instance[^\n]*(?:invalid|no longer exists)|GPU(?:Adapter|Device)[^\n]*(?:invalid|lost|destroyed|unavailable)|adapter[^\n]*(?:invalidated|no longer valid)|device[^\n]*(?:invalidated|no longer valid)/i.test(
			value,
		)
	);
}
