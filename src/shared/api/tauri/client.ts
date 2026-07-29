import { invoke } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";

export type AppErrorCode =
  | "NOT_FOUND"
  | "FILE_MISSING"
  | "UNSUPPORTED_FORMAT"
  | "DATABASE_ERROR"
  | "AUDIO_DEVICE_ERROR"
  | "PLAYBACK_ERROR"
  | "ANALYSIS_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export type AppErrorDto = {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(dto: AppErrorDto) {
    super(dto.message);
    this.name = "AppError";
    this.code = dto.code;
    this.details = dto.details;
  }
}

const normalizeError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const dto = error as Partial<AppErrorDto>;
    return new AppError({ code: dto.code ?? "UNKNOWN", message: String(dto.message), details: dto.details });
  }
  return new AppError({ code: "UNKNOWN", message: String(error) });
};

export async function command<TResult>(name: string, args?: Record<string, unknown>): Promise<TResult> {
  try {
    return await invoke<TResult>(name, args);
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function subscribe<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  return listen<T>(event, ({ payload }) => handler(payload));
}
