import { desktopCapturer } from 'electron';
import type { ScreenFrame } from '@botprogracraft/shared';

export async function capturePrimaryScreenFrame(): Promise<ScreenFrame | null> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1280, height: 720 },
  });

  const primary = sources[0];
  if (!primary) {
    return null;
  }

  const jpegBuffer = primary.thumbnail.toJPEG(75);
  const size = primary.thumbnail.getSize();

  return {
    mimeType: 'image/jpeg',
    dataBase64: jpegBuffer.toString('base64'),
    width: size.width,
    height: size.height,
    timestamp: Date.now(),
    sourceId: primary.id,
    sourceName: primary.name,
  };
}
