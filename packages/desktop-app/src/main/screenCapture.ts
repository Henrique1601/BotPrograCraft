import { desktopCapturer } from 'electron';
import type { ScreenFrame } from '@botprogracraft/shared';

export interface CaptureSourceSummary {
  id: string;
  name: string;
  kind: 'screen' | 'window';
  thumbnailDataUrl: string;
}

let selectedSourceId: string | null = null;

export function setCaptureSource(sourceId: string | null): void {
  selectedSourceId = sourceId && sourceId.trim() ? sourceId.trim() : null;
}

export function getCaptureSource(): string | null {
  return selectedSourceId;
}

export async function listCaptureSources(): Promise<CaptureSourceSummary[]> {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 160, height: 90 },
  });

  return sources.map((src) => ({
    id: src.id,
    name: src.name,
    kind: src.id.startsWith('window:') ? 'window' : 'screen',
    thumbnailDataUrl: src.thumbnail.toDataURL(),
  }));
}

export async function capturePrimaryScreenFrame(): Promise<ScreenFrame | null> {
  const types: Array<'screen' | 'window'> = selectedSourceId
    ? ['screen', 'window']
    : ['screen'];

  const sources = await desktopCapturer.getSources({
    types,
    thumbnailSize: { width: 1280, height: 720 },
  });

  const target =
    (selectedSourceId
      ? sources.find((src) => src.id === selectedSourceId)
      : undefined) ?? sources[0];

  if (!target) {
    return null;
  }

  const jpegBuffer = target.thumbnail.toJPEG(75);
  const size = target.thumbnail.getSize();

  return {
    mimeType: 'image/jpeg',
    dataBase64: jpegBuffer.toString('base64'),
    width: size.width,
    height: size.height,
    timestamp: Date.now(),
    sourceId: target.id,
    sourceName: target.name,
  };
}
