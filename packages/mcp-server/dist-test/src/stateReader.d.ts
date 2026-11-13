import { type IdeContextPayload, type TutorMode } from '@botprogracraft/shared';
import { ProgressRepository } from '@botprogracraft/storage';
export interface LiveStateSnapshot {
    ideContext: IdeContextPayload | null;
    tutorMode: TutorMode | null;
    updatedAt: string | number | null;
}
export interface LiveFrameMeta {
    width: number | null;
    height: number | null;
    timestamp: number | string | null;
}
export interface LiveScreenSnapshot extends LiveFrameMeta {
    imageBase64: string;
    mimeType: 'image/jpeg';
}
/**
 * Resolves the shared BotPrograCraft state directory.
 * Respects an explicit override, then `process.env.BOTPROGRACRAFT_HOME`,
 * falling back to `~/.botprogracraft`.
 */
export declare function getBotPrograCraftHome(homeOverride?: string): string;
/**
 * Reads `live-state.json` from the shared BotPrograCraft home directory.
 * Returns `null` if the file does not exist yet.
 */
export declare function readLiveState(homeOverride?: string): LiveStateSnapshot | null;
/**
 * Reads `latest-frame.jpg` and optional `latest-frame.meta.json` from the shared
 * BotPrograCraft home directory. Returns `null` if no frame has been captured yet.
 */
export declare function readLatestFrame(homeOverride?: string): LiveScreenSnapshot | null;
/**
 * Opens the shared SQLite `ProgressRepository` at `<home>/botprogracraft.db`.
 * Callers should invoke `repo.close()` when finished to avoid holding file locks.
 */
export declare function openProgressRepository(homeOverride?: string): ProgressRepository;
//# sourceMappingURL=stateReader.d.ts.map